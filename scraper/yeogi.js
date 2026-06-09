'use strict';

const { chromium } = require('playwright');
const { getAllRegions } = require('./regions');

const BASE_URL = 'https://www.yeogi.com';

// 여기어때 숙박 유형 파라미터 매핑
const YEOGI_TYPE = {
  motel:      'MOTEL',
  hotel:      'HOTEL',
  pension:    'PENSION',
  guesthouse: 'GUESTHOUSE',
};

const PRICE_LIMITS = {
  motel:      { min: 15000, max: 150000  },  // 모텔은 15만원 상한 (호텔 혼입 방지)
  hotel:      { min: 30000, max: 2000000 },
  pension:    { min: 10000, max: 1500000 },
  guesthouse: { min: 5000,  max: 300000  },
};

// Schema.org @type → 허용 숙박 유형 매핑 (소문자)
const ALLOWED_SCHEMA_TYPES = {
  motel:      ['motel', 'lodgingbusiness', ''],   // 명시 없으면 허용
  hotel:      ['hotel', 'lodgingbusiness', ''],
  pension:    ['bedandbreakfast', 'lodgingbusiness', 'vacationrental', ''],
  guesthouse: ['hostel', 'lodgingbusiness', ''],
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
  const cleaned = String(text).replace(/,/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n < limits.min || n > limits.max ? null : n;
}

/**
 * 여기어때 특정 지역 숙박 목록 스크래핑
 * @param {{ city, district, yeogiKeyword, accommodationType }} region
 * @param {import('playwright').BrowserContext} ctx
 */
async function scrapeRegion(region, ctx) {
  const { checkin, checkout } = getTodayCheckout();
  const { city, district, yeogiKeyword, accommodationType = 'motel' } = region;
  const limits = PRICE_LIMITS[accommodationType] || PRICE_LIMITS.motel;
  const yeogiType = YEOGI_TYPE[accommodationType] || 'MOTEL';

  const keyword = encodeURIComponent(yeogiKeyword);
  const url = `${BASE_URL}/domestic-accommodations?keyword=${keyword}&checkIn=${checkin}&checkOut=${checkout}&personal=2&type=${yeogiType}`;

  const page = await ctx.newPage();
  const results = [];

  try {
    console.log(`  [여기어때/${accommodationType}] ${city} ${district} 로딩 중...`);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await autoScroll(page);
    await page.waitForTimeout(1500);

    const scrapedAt = new Date().toISOString();

    // 1순위: JSON-LD 구조화 데이터 (Schema.org ItemList)
    const ldResults = await extractFromJsonLd(page, city, district, accommodationType, scrapedAt, limits);
    if (ldResults.length > 0) {
      results.push(...ldResults);
    } else {
      // 2순위: DOM 파싱 폴백
      const domResults = await parseDom(page, city, district, accommodationType, scrapedAt, limits);
      results.push(...domResults);
    }

    console.log(`  [여기어때/${accommodationType}] ${city} ${district}: ${results.length}건 수집`);
  } catch (err) {
    console.error(`  [여기어때/${accommodationType}] ${city} ${district} 오류: ${err.message.slice(0, 80)}`);
  } finally {
    await page.close();
  }

  return results;
}

async function extractFromJsonLd(page, city, district, accommodationType, scrapedAt, limits) {
  try {
    // 페이지 내 모든 JSON-LD 스크립트 시도
    const ldTexts = await page.$$eval(
      'script[type="application/ld+json"]',
      (els) => els.map((el) => el.textContent)
    );

    const results = [];
    for (const ldText of ldTexts) {
      try {
        const data = JSON.parse(ldText);
        const items = data?.mainEntity?.itemListElement ?? data?.itemListElement ?? [];
        for (const item of items) {
          const hotel = item.item ?? item;
          if (!hotel) continue;

          // @type 체크: 명시된 경우 허용 목록과 대조
          const schemaType = (hotel['@type'] || '').toLowerCase();
          const allowed = ALLOWED_SCHEMA_TYPES[accommodationType] || [''];
          if (schemaType && !allowed.includes(schemaType)) {
            continue; // 예: 모텔 검색에서 @type=Hotel 이면 제외
          }

          const name = hotel.name;
          const priceText = hotel.priceRange ?? '';
          // "1박 기준 62,000원" → 62000
          const priceMatch = priceText.match(/([0-9][0-9,]+)원/);
          const price = priceMatch ? parsePrice(priceMatch[1], limits) : null;
          if (name && price) {
            results.push({ hotelName: name, price, city, district, accommodationType, scrapedAt });
          }
        }
        if (results.length > 0) break;
      } catch (_) {}
    }
    return results;
  } catch (_) {
    return [];
  }
}

async function parseDom(page, city, district, accommodationType, scrapedAt, limits) {
  const results = [];
  try {
    const cards = await page.$$eval(
      '[href*="/domestic-accommodations/"]',
      (anchors) =>
        anchors.map((a) => {
          const nameEl = a.querySelector('[class*="name"], [class*="title"], h3, h4, strong');
          const priceEls = a.querySelectorAll('*');
          let firstPrice = '';
          let secondPrice = '';
          let count = 0;
          for (const el of priceEls) {
            if (el.children.length > 0) continue;
            const t = (el.textContent || '').replace(/,/g, '').trim();
            if (/^\d{5,7}$/.test(t)) {
              if (count === 0) firstPrice = t;
              if (count === 1) { secondPrice = t; break; }
              count++;
            }
          }
          return { name: nameEl ? nameEl.textContent.trim() : '', price: secondPrice || firstPrice };
        })
    );

    for (const card of cards) {
      const price = parsePrice(card.price, limits);
      if (card.name && price) {
        results.push({ hotelName: card.name, price, city, district, accommodationType, scrapedAt });
      }
    }
  } catch (_) {}
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
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
