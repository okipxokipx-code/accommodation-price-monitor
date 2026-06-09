'use strict';

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

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
const { saveResults, pruneOld } = require('../db/database');

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
  const { chromium } = require('playwright');
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

// NOL(야놀자) 웹에서 지원하는 숙박 유형 (guesthouse는 앱 전용 — 웹 에러 페이지 반환)
const NOL_TYPES = ['motel', 'hotel', 'pension'];

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

  // 여기어때 — 전체 유형 (guesthouse 포함)
  try {
    const n = await scrapePlatform('여기어때', require('../scraper/yeogi'), allTypes);
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
}

// ── 즉시 1회 실행 + 매 정각 반복 ─────────────────────────────────────────
log('=== 전국 숙박 객단가 모니터링 에이전트 시작 ===');
log(`수집 대상: ${getAccommodationTypes().join(' / ')} × 야놀자 + 여기어때`);

scrapeAll().catch((err) => log(`초기 스크래핑 오류: ${err.message}`));

cron.schedule('0 * * * *', () => {
  scrapeAll().catch((err) => log(`정기 스크래핑 오류: ${err.message}`));
});

require('../dashboard/server');
log('스케줄러 등록 완료 (매 시 정각 실행) — 대시보드: http://localhost:3000');
