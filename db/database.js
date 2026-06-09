'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'prices.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// 테이블 생성 (없을 때만)
db.exec(`
  CREATE TABLE IF NOT EXISTS prices (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    platform           TEXT NOT NULL,
    accommodation_type TEXT NOT NULL DEFAULT 'motel',
    region_city        TEXT NOT NULL,
    region_district    TEXT NOT NULL,
    hotel_name         TEXT NOT NULL,
    price              INTEGER NOT NULL,
    scraped_at         TEXT NOT NULL
  );
`);

// 기존 테이블에 accommodation_type 컬럼 없으면 추가 (마이그레이션) — 인덱스 생성 전에 실행
const cols = db.prepare("PRAGMA table_info(prices)").all().map((c) => c.name);
if (!cols.includes('accommodation_type')) {
  db.exec("ALTER TABLE prices ADD COLUMN accommodation_type TEXT NOT NULL DEFAULT 'motel'");
  console.log('[DB] accommodation_type 컬럼 추가 완료 (기존 데이터 → motel)');
}

// 인덱스 생성 (컬럼 확보 후)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_region_type_platform_time
    ON prices (region_city, region_district, accommodation_type, platform, scraped_at);

  CREATE INDEX IF NOT EXISTS idx_scraped_at
    ON prices (scraped_at);

  CREATE INDEX IF NOT EXISTS idx_accom_type
    ON prices (accommodation_type, scraped_at);
`);

// ─── 삽입 ──────────────────────────────────────────────────────────────────
const insertStmt = db.prepare(`
  INSERT INTO prices (platform, accommodation_type, region_city, region_district, hotel_name, price, scraped_at)
  VALUES (@platform, @accommodation_type, @region_city, @region_district, @hotel_name, @price, @scraped_at)
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) insertStmt.run(row);
});

/**
 * @param {'yanolja'|'yeogi'} platform
 * @param {Array<{hotelName,price,city,district,accommodationType,scrapedAt}>} rows
 */
function saveResults(platform, rows) {
  const mapped = rows.map((r) => ({
    platform,
    accommodation_type: r.accommodationType || 'motel',
    region_city: r.city,
    region_district: r.district,
    hotel_name: r.hotelName,
    price: r.price,
    scraped_at: r.scrapedAt,
  }));
  insertMany(mapped);
  return mapped.length;
}

// ─── 집계 헬퍼 ────────────────────────────────────────────────────────────

function resolveHourRange(city, district, platform, hour, accommodationType) {
  const platformClause = platform && platform !== 'all' ? `AND platform = '${platform}'` : '';
  const typeClause = accommodationType && accommodationType !== 'all'
    ? `AND accommodation_type = '${accommodationType}'` : '';

  if (hour === 'latest' || !hour) {
    const row = db
      .prepare(
        `SELECT strftime('%Y-%m-%dT%H', scraped_at) AS h
         FROM prices
         WHERE region_city = ? AND region_district = ?
           ${platformClause} ${typeClause}
         ORDER BY scraped_at DESC LIMIT 1`
      )
      .get(city, district);
    if (!row) return null;
    return { from: row.h + ':00:00', to: row.h + ':59:59' };
  }
  return { from: hour + ':00:00', to: hour + ':59:59' };
}

function buildWhereClause(platform, accommodationType) {
  const parts = [];
  if (platform && platform !== 'all') parts.push(`platform = @platform`);
  if (accommodationType && accommodationType !== 'all') parts.push(`accommodation_type = @accommodationType`);
  return parts.length ? 'AND ' + parts.join(' AND ') : '';
}

function getTop3(city, district, platform = 'all', hour = 'latest', accommodationType = 'all') {
  const range = resolveHourRange(city, district, platform, hour, accommodationType);
  if (!range) return [];
  const where = buildWhereClause(platform, accommodationType);
  return db
    .prepare(
      `SELECT hotel_name, price, platform, accommodation_type, scraped_at
       FROM prices
       WHERE region_city = @city AND region_district = @district
         AND scraped_at BETWEEN @from AND @to ${where}
       ORDER BY price DESC LIMIT 3`
    )
    .all({ city, district, platform: platform !== 'all' ? platform : undefined,
           accommodationType: accommodationType !== 'all' ? accommodationType : undefined,
           from: range.from, to: range.to });
}

function getBottom3(city, district, platform = 'all', hour = 'latest', accommodationType = 'all') {
  const range = resolveHourRange(city, district, platform, hour, accommodationType);
  if (!range) return [];
  const where = buildWhereClause(platform, accommodationType);
  return db
    .prepare(
      `SELECT hotel_name, price, platform, accommodation_type, scraped_at
       FROM prices
       WHERE region_city = @city AND region_district = @district
         AND scraped_at BETWEEN @from AND @to ${where}
       ORDER BY price ASC LIMIT 3`
    )
    .all({ city, district, platform: platform !== 'all' ? platform : undefined,
           accommodationType: accommodationType !== 'all' ? accommodationType : undefined,
           from: range.from, to: range.to });
}

function getAverage(city, district, platform = 'all', hour = 'latest', accommodationType = 'all') {
  const range = resolveHourRange(city, district, platform, hour, accommodationType);
  if (!range) return null;
  const where = buildWhereClause(platform, accommodationType);
  return db
    .prepare(
      `SELECT ROUND(AVG(price)) AS avg_price, COUNT(*) AS count
       FROM prices
       WHERE region_city = @city AND region_district = @district
         AND scraped_at BETWEEN @from AND @to ${where}`
    )
    .get({ city, district, platform: platform !== 'all' ? platform : undefined,
           accommodationType: accommodationType !== 'all' ? accommodationType : undefined,
           from: range.from, to: range.to });
}

function getHistory(city, district, platform = 'all', hours = 24, accommodationType = 'all') {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const platformClause = platform !== 'all' ? `AND platform = ?` : '';
  const typeClause = accommodationType !== 'all' ? `AND accommodation_type = ?` : '';
  const params = [city, district, since];
  if (platform !== 'all') params.push(platform);
  if (accommodationType !== 'all') params.push(accommodationType);

  return db
    .prepare(
      `SELECT strftime('%Y-%m-%dT%H', scraped_at) AS hour,
              accommodation_type,
              ROUND(AVG(price)) AS avg_price,
              COUNT(*) AS count
       FROM prices
       WHERE region_city = ? AND region_district = ? AND scraped_at >= ?
         ${platformClause} ${typeClause}
       GROUP BY hour, accommodation_type
       ORDER BY hour ASC`
    )
    .all(...params);
}

function getSummary(city, district, platform = 'all', hour = 'latest', accommodationType = 'all') {
  return {
    top3: getTop3(city, district, platform, hour, accommodationType),
    bottom3: getBottom3(city, district, platform, hour, accommodationType),
    average: getAverage(city, district, platform, hour, accommodationType),
    lastUpdated: resolveHourRange(city, district, platform, hour, accommodationType)?.to ?? null,
  };
}

/**
 * 전국 개요: 숙박 유형별 × 플랫폼별 평균 객단가 (가장 최근 배치)
 */
function getOverview() {
  const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  return db
    .prepare(
      `SELECT accommodation_type, platform,
              region_city AS city,
              ROUND(AVG(price)) AS avg_price,
              COUNT(*) AS count,
              MAX(scraped_at) AS last_scraped
       FROM prices
       WHERE scraped_at >= ?
       GROUP BY accommodation_type, platform, region_city
       ORDER BY accommodation_type, platform, region_city`
    )
    .all(since);
}

function pruneOld(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const info = db.prepare(`DELETE FROM prices WHERE scraped_at < ?`).run(cutoff);
  return info.changes;
}

/**
 * Vercel 대시보드용 JSON 내보내기
 * - 최근 2시간 배치 기준 통계
 * - 최근 24시간 시간별 트렌드
 */
function exportDashboardData() {
  const since2h  = new Date(Date.now() -  2 * 3600 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const types    = ['motel', 'hotel', 'pension', 'guesthouse'];

  const result = { updatedAt: new Date().toISOString(), types: {} };

  for (const type of types) {
    // 플랫폼별 통계
    const platforms = {};
    for (const plat of ['all', 'yanolja', 'yeogi']) {
      const platClause = plat !== 'all' ? `AND platform = '${plat}'` : '';
      platforms[plat] = db.prepare(`
        SELECT ROUND(AVG(price)) AS avg, COUNT(*) AS count,
               MIN(price) AS min, MAX(price) AS max
        FROM prices
        WHERE accommodation_type = ? AND scraped_at >= ? ${platClause}
      `).get(type, since2h) || { avg: null, count: 0, min: null, max: null };
    }

    // ── 구 단위 통계 (최근 2h) ─────────────────────────────
    const districtRaw = db.prepare(`
      SELECT region_city AS city, region_district AS district,
             ROUND(AVG(price)) AS avg, COUNT(*) AS count,
             MIN(price) AS min, MAX(price) AS max
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, region_district
      ORDER BY region_city, count DESC
    `).all(type, since2h);

    // 구 단위 × 플랫폼별 (최근 2h)
    const districtPlatRows = db.prepare(`
      SELECT region_city AS city, region_district AS district, platform,
             ROUND(AVG(price)) AS avg, COUNT(*) AS count
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, region_district, platform
    `).all(type, since2h);

    // 구 단위 × 시간별 트렌드 (24h)
    const districtTrendRows = db.prepare(`
      SELECT region_city AS city, region_district AS district,
             strftime('%Y-%m-%dT%H:00', scraped_at) AS hour,
             platform,
             ROUND(AVG(price)) AS avg,
             COUNT(*) AS count
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, region_district, hour, platform
      ORDER BY city, district, hour ASC
    `).all(type, since24h);

    // 구 단위 호텔명 기준 중복 제거 후 대표가 (최신 1건)
    const districtTopRows = db.prepare(`
      SELECT region_city AS city, region_district AS district,
             hotel_name, MAX(price) AS price, platform
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, region_district, hotel_name
      ORDER BY region_city, region_district, price DESC
    `).all(type, since2h);

    // 구 단위에 플랫폼 + 트렌드 + 호텔 목록 병합
    const districtsWithDetail = districtRaw.map(d => {
      const plats = {};
      districtPlatRows
        .filter(r => r.city === d.city && r.district === d.district)
        .forEach(r => { plats[r.platform] = { avg: r.avg, count: r.count }; });
      const trend = districtTrendRows.filter(r => r.city === d.city && r.district === d.district);
      const allHotels = districtTopRows.filter(r => r.city === d.city && r.district === d.district);
      const top5 = allHotels.slice(0, 5);
      const bottom5 = [...allHotels].sort((a, b) => a.price - b.price).slice(0, 5);
      return { ...d, platforms: plats, trend, top5, bottom5 };
    });

    // 시 단위로 그룹화 (districts 배열 포함)
    const cityMap = {};
    districtsWithDetail.forEach(d => {
      if (!cityMap[d.city]) {
        cityMap[d.city] = { city: d.city, avg: 0, count: 0, min: null, max: null, platforms: {}, trend: [], districts: [] };
      }
      cityMap[d.city].districts.push(d);
    });

    // 시 단위 Top5/Bottom5 (모든 구 통합)
    const cityTopRows = db.prepare(`
      SELECT region_city AS city,
             hotel_name, MAX(price) AS price, platform
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, hotel_name
      ORDER BY region_city, price DESC
    `).all(type, since2h);
    Object.keys(cityMap).forEach(city => {
      const rows = cityTopRows.filter(r => r.city === city);
      cityMap[city].top5    = rows.slice(0, 5);
      cityMap[city].bottom5 = [...rows].sort((a, b) => a.price - b.price).slice(0, 5);
    });

    // 시 단위 집계
    const citiesRaw = db.prepare(`
      SELECT region_city AS city,
             ROUND(AVG(price)) AS avg, COUNT(*) AS count,
             MIN(price) AS min, MAX(price) AS max
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city
      ORDER BY count DESC
    `).all(type, since2h);

    const cityPlatRows = db.prepare(`
      SELECT region_city AS city, platform,
             ROUND(AVG(price)) AS avg, COUNT(*) AS count
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, platform
    `).all(type, since2h);

    const cityTrendRows = db.prepare(`
      SELECT region_city AS city,
             strftime('%Y-%m-%dT%H:00', scraped_at) AS hour,
             platform,
             ROUND(AVG(price)) AS avg, COUNT(*) AS count
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY region_city, hour, platform
      ORDER BY city, hour ASC
    `).all(type, since24h);

    const cities = citiesRaw.map(c => {
      const plats = {};
      cityPlatRows.filter(r => r.city === c.city).forEach(r => { plats[r.platform] = { avg: r.avg, count: r.count }; });
      const trend    = cityTrendRows.filter(r => r.city === c.city);
      const districts = (cityMap[c.city]?.districts) || [];
      const top5     = cityMap[c.city]?.top5    || [];
      const bottom5  = cityMap[c.city]?.bottom5 || [];
      return { ...c, platforms: plats, trend, districts, top5, bottom5 };
    });

    // 전국 시간별 트렌드
    const hourlyTrend = db.prepare(`
      SELECT strftime('%Y-%m-%dT%H:00', scraped_at) AS hour,
             platform,
             ROUND(AVG(price)) AS avg, COUNT(*) AS count
      FROM prices
      WHERE accommodation_type = ? AND scraped_at >= ?
      GROUP BY hour, platform
      ORDER BY hour ASC
    `).all(type, since24h);

    result.types[type] = { platforms, cities, hourlyTrend };
  }

  return result;
}

module.exports = {
  db, saveResults,
  getTop3, getBottom3, getAverage, getHistory, getSummary, getOverview,
  exportDashboardData, pruneOld,
};
