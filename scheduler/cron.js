'use strict';

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// p-limit v4는 ESM 전용 — CommonJS 호환 인라인 구현
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  function next() {
    while (active < concurrency && queue.length) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
    }
  }
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

const { getRegionsByType, getAccommodationTypes } = require('../scraper/regions');
const { saveResults, pruneOld, exportDashboardData } = require('../db/database');

const DATA_EXPORT_DIR = path.join(__dirname, '..', 'data-export');
fs.mkdirSync(DATA_EXPORT_DIR, { recursive: true });

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'scrape.log');
fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// 동시 스크래핑 수 (IP 차단 방지)
const CONCURRENCY = 5;

async function scrapeByType(type, scrapeRegion, ctx) {
  const regions = getRegionsByType(type);
  let total = 0;
  const limit = pLimit(CONCURRENCY);

  const tasks = regions.map((region) =>
    limit(async () => {
      try {
        const data = await scrapeRegion(region, ctx);
        if (data.length > 0) {
          saveResults(region.platform || 'yanolja', data);
          total += data.length;
        }
      } catch (err) {
        log(`[오류] ${type}/${region.city} ${region.district}: ${err.message.slice(0, 80)}`);
      }
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    })
  );

  await Promise.all(tasks);
  return total;
}

async function scrapePlatform(platformName, scraperModule, types) {
  const { chromium } = require('playwright-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  chromium.use(StealthPlugin());
  const { scrapeRegion } = scraperModule;
  types = types || getAccommodationTypes();

  log(`--- ${platformName} 스크래핑 시작 (${types.join(', ')}) ---`);
  let platformTotal = 0;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const userAgent = platformName === '야놀자'
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const ctx = await browser.newContext({ userAgent, viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });

  try {
    for (const type of types) {
      const regions = getRegionsByType(type);
      const limit = pLimit(CONCURRENCY);
      let typeTotal = 0;

      const tasks = regions.map((region) =>
        limit(async () => {
          try {
            const data = await scrapeRegion(region, ctx);
            if (data.length > 0) {
              saveResults(platformName === '야놀자' ? 'yanolja' : 'yeogi', data);
              typeTotal += data.length;
              platformTotal += data.length;
            }
          } catch (err) {
            log(`[${platformName}/${type} 오류] ${region.city} ${region.district}: ${err.message.slice(0, 60)}`);
          }
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
        })
      );

      await Promise.all(tasks);
      log(`  ${platformName}/${type}: ${typeTotal}건 (${regions.length}개 지역)`);
    }
  } finally {
    await browser.close();
  }

  log(`--- ${platformName} 완료: 총 ${platformTotal}건 저장 ---`);
  return platformTotal;
}

// NOL(야놀자): guesthouse 앱 전용 제외
const NOL_TYPES = ['motel', 'hotel', 'pension'];
// 여기어때: motel 제외 (JSON-LD 방식으로 호텔이 혼입되는 품질 문제)
const YEOGI_TYPES = ['hotel', 'pension', 'guesthouse'];

async function scrapeAll() {
  const allTypes = getAccommodationTypes();
  const nolRegions  = NOL_TYPES.reduce((s, t) => s + getRegionsByType(t).length, 0);
  const allRegions  = allTypes.reduce((s, t) => s + getRegionsByType(t).length, 0);
  log(`=== 스크래핑 시작: 야놀자(${NOL_TYPES.join('/')} ${nolRegions}지역) + 여기어때(${allTypes.join('/')} ${allRegions}지역) ===`);

  let total = 0;

  // 야놀자 (NOL) — motel/hotel/pension만
  try {
    const n = await scrapePlatform('야놀자', require('../scraper/yanolja'), NOL_TYPES);
    total += n;
  } catch (err) {
    log(`[야놀자 치명 오류] ${err.message}`);
  }

  // 여기어때 — motel 제외 (hotel/pension/guesthouse만)
  try {
    const n = await scrapePlatform('여기어때', require('../scraper/yeogi'), YEOGI_TYPES);
    total += n;
  } catch (err) {
    log(`[여기어때 치명 오류] ${err.message}`);
  }

  // 30일 이전 데이터 정리 (자정에만)
  if (new Date().getHours() === 0) {
    const deleted = pruneOld(30);
    if (deleted > 0) log(`오래된 데이터 ${deleted}건 삭제`);
  }

  log(`=== 완료: 총 ${total}건 저장 ===`);

  // ── JSON 내보내기 + GitHub 자동 푸시 (재시도 3회) ────────────────
  try {
    const data = exportDashboardData();
    const outPath = path.join(DATA_EXPORT_DIR, 'latest.json');
    fs.writeFileSync(outPath, JSON.stringify(data));
    log(`JSON 내보내기 완료 → data-export/latest.json (${data.updatedAt})`);

    const repoDir = path.join(__dirname, '..');
    const gitPath = '/usr/bin/git';
    const ghPath = path.join(process.env.HOME, 'bin', 'gh');
    const env = { ...process.env, PATH: `${process.env.HOME}/bin:/usr/local/bin:/usr/bin:/bin` };

    try {
      const token = execSync(`${ghPath} auth token`, { env, stdio: 'pipe' }).toString().trim();
      execSync(`${gitPath} config credential.helper '!f(){ echo username=x-token-auth; echo password=${token}; }; f'`,
        { cwd: repoDir, stdio: 'pipe' });
    } catch (_) {}

    execSync(`${gitPath} add data-export/latest.json`, { cwd: repoDir, stdio: 'pipe' });
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    try {
      execSync(`${gitPath} commit -m "데이터 갱신: ${timestamp}"`, { cwd: repoDir, stdio: 'pipe' });
    } catch (_) { /* 변경사항 없으면 commit 스킵 */ }

    // push 재시도 3회 (네트워크 일시 끊김 대비)
    let pushed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execSync(`${gitPath} push`, { cwd: repoDir, env, stdio: 'pipe', timeout: 30000 });
        log(`GitHub 자동 푸시 완료 ✓ (${attempt}회)`);
        pushed = true;
        break;
      } catch (pushErr) {
        log(`[푸시 실패 ${attempt}/3] ${pushErr.message.slice(0, 80)}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 10000)); // 10초 대기 후 재시도
      }
    }
    if (!pushed) log('[푸시 최종 실패] 다음 수집 시 재시도됩니다.');
  } catch (err) {
    log(`[JSON/푸시 오류] ${err.message.slice(0, 120)}`);
  }
}

// ── 크래시 방지: uncaughtException / unhandledRejection 잡기 ──────────────
process.on('uncaughtException', (err) => {
  log(`[치명 오류 포착 - 계속 실행] ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log(`[미처리 거절 포착 - 계속 실행] ${reason}`);
});

// ── 즉시 1회 실행 + 매 정각 반복 ─────────────────────────────────────────
log('=== 전국 숙박 객단가 모니터링 에이전트 시작 ===');
log(`수집 대상: ${getAccommodationTypes().join(' / ')} × 야놀자 + 여기어때`);

scrapeAll().catch((err) => log(`초기 스크래핑 오류: ${err.message}`));

cron.schedule('0 * * * *', () => {
  scrapeAll().catch((err) => log(`정기 스크래핑 오류: ${err.message}`));
});

require('../dashboard/server');
log('스케줄러 등록 완료 (매 시 정각 실행) — 대시보드: http://localhost:3000');
