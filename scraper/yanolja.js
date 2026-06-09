'use strict';

const { chromium } = require('playwright');
const { getAllRegions } = require('./regions');

const BASE_URL = 'https://nol.yanolja.com';

// 숙박 유형별 가격 상한 (이상값 필터)
const PRICE_LIMITS = {
  motel:      { min: 5000,  max: 500000  },
  hotel:      { min: 20000, max: 2000000 },
  pension:    { min: 10000, max: 1500000 },
  guesthouse: { min: 5000,  max: 300000  },
};

function getTodayCheckout() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { checkin: fmt(today), checkout: fmt(tomorrow) };
}

function delay(min = 800, max = 2000) {
  return new Promise((r) => setTimeout(r, Math.random() * (max - min) + min));
}

function parsePrice(text, limits) {
  if (!text) return null;
  const n = parseInt(String(text).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) || n < limits.min || n > limits.max ? null : n;
}

/**
 * NOL 특정 지역 숙박 목록 스크래핑
 * @param {{ city, district, yanoljaRegion, accommodationType }} region
 * @param {import('playwright').BrowserContext} ctx
 */
async function scrapeRegion(region, ctx) {
  const { checkin, checkout } = getTodayCheckout();
  const { city, district, yanoljaRegion, accommodationType = 'motel' } = region;
  const limits = PRICE_LIMITS[accommodationType] || PRICE_LIMITS.motel;

  // NOL URL: type 파라미터에 숙박 유형 전달 (motel, hotel, pension, guesthouse)
  const url = `${BASE_URL}/local/list?type=${accommodationType}&region=${yanoljaRegion}&checkin=${checkin}&checkout=${checkout}&adults=2`;
  const page = await ctx.newPage();
  const results = [];

  try {
    console.log(`  [야놀자/${accommodationType}] ${city} ${district} 로딩 중...`);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // 카드 셀렉터: 모텔은 /stay/domestic/, 호텔/펜션/게하는 /accommodation/ 또는 /stay/domestic/
    const cardSelector = 'a[href*="/stay/domestic/"], a[href*="/accommodation/"]';

    const cards = await page.$$eval(
      cardSelector,
      (anchors) =>
        anchors.map((a) => {
          const nameEl =
            a.querySelector('p[class*="subtitle-16-bold"]') ||
            a.querySelector('p[class*="subtitle-14-bold"]') ||
            a.querySelector('[class*="name"], [class*="title"]');
          const priceEls = a.querySelectorAll('[class*="subtitle-18-bold"], [class*="subtitle-16-bold"][class*="price"]');
          const prices = [];
          for (const el of priceEls) {
            const t = (el.textContent || '').replace(/[^0-9]/g, '');
            if (t && !el.className.includes('line-through')) prices.push(t);
          }
          // 대실가(첫번째) 보다 숙박가(두번째) 우선
          return {
            name: nameEl ? nameEl.textContent.trim() : '',
            price: prices[1] ?? prices[0] ?? '',
          };
        })
    );

    const scrapedAt = new Date().toISOString();
    for (const card of cards) {
      const price = parsePrice(card.price, limits);
      if (card.name && price) {
        results.push({ hotelName: card.name, price, city, district, accommodationType, scrapedAt });
      }
    }

    console.log(`  [야놀자/${accommodationType}] ${city} ${district}: ${results.length}건 수집`);
  } catch (err) {
    console.error(`  [야놀자/${accommodationType}] ${city} ${district} 오류: ${err.message.slice(0, 80)}`);
  } finally {
    await page.close();
  }

  return results;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const dist = 800;
      const t = setInterval(() => {
        window.scrollBy(0, dist);
        total += dist;
        if (total >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(t);
          resolve();
        }
      }, 300);
    });
  });
}

async function runAll(targetRegions) {
  const regions = targetRegions ?? getAllRegions();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
  });

  const allResults = [];
  for (const region of regions) {
    const data = await scrapeRegion(region, ctx);
    allResults.push(...data);
    await delay();
  }

  await browser.close();
  return allResults;
}

module.exports = { runAll, scrapeRegion };
