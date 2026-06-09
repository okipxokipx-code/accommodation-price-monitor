'use strict';

const express = require('express');
const path = require('path');
const { REGIONS_BY_TYPE, getAccommodationTypes } = require('../scraper/regions');
const { getSummary, getHistory, getAverage, getOverview } = require('../db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── GET /api/regions ──────────────────────────────────────────────────────
// query: type (motel|hotel|pension|guesthouse|all, 기본 all)
app.get('/api/regions', (req, res) => {
  const { type = 'all' } = req.query;

  // 도시별로 그룹핑, 지역구 배열
  const grouped = {};
  const types = type === 'all' ? getAccommodationTypes() : [type];

  for (const t of types) {
    const regions = REGIONS_BY_TYPE[t] || [];
    for (const r of regions) {
      if (!grouped[r.city]) grouped[r.city] = new Set();
      grouped[r.city].add(r.district);
    }
  }

  const out = Object.entries(grouped).map(([city, districts]) => ({
    city,
    districts: [...districts],
  }));
  res.json(out);
});

// ── GET /api/accommodation-types ──────────────────────────────────────────
app.get('/api/accommodation-types', (_req, res) => {
  const labels = { motel: '모텔', hotel: '호텔', pension: '펜션', guesthouse: '게스트하우스' };
  res.json(getAccommodationTypes().map((t) => ({ value: t, label: labels[t] || t })));
});

// ── GET /api/summary ──────────────────────────────────────────────────────
// query: region, district, platform (all|yanolja|yeogi), hour, accommodationType
app.get('/api/summary', (req, res) => {
  const { region: city, district, platform = 'all', hour = 'latest', accommodationType = 'all' } = req.query;
  if (!city || !district) {
    return res.status(400).json({ error: 'region과 district 파라미터가 필요합니다.' });
  }
  try {
    const data = getSummary(city, district, platform, hour, accommodationType);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/history ──────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  const { region: city, district, platform = 'all', hours = '24', accommodationType = 'all' } = req.query;
  if (!city || !district) {
    return res.status(400).json({ error: 'region과 district 파라미터가 필요합니다.' });
  }
  try {
    const data = getHistory(city, district, platform, parseInt(hours, 10), accommodationType);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/overview ─────────────────────────────────────────────────────
// 숙박유형 × 시/도별 × 플랫폼별 평균 객단가 목록
app.get('/api/overview', (_req, res) => {
  try {
    const data = getOverview();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/type-stats ───────────────────────────────────────────────────
// 숙박 유형별 전국 평균 통계
app.get('/api/type-stats', (_req, res) => {
  try {
    const { db } = require('../db/database');
    const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const rows = db
      .prepare(
        `SELECT accommodation_type, platform,
                ROUND(AVG(price)) AS avg_price,
                ROUND(MIN(price)) AS min_price,
                ROUND(MAX(price)) AS max_price,
                COUNT(*) AS count
         FROM prices
         WHERE scraped_at >= ?
         GROUP BY accommodation_type, platform
         ORDER BY accommodation_type, platform`
      )
      .all(since);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[대시보드] http://localhost:${PORT} 에서 실행 중`);
});

module.exports = app;
