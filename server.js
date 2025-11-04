// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   CORS: allow set origins with wildcard support
   Env:
     ALLOWED_ORIGINS = comma-separated list, e.g.
       "https://www.ledspace.co.uk, https://ledspace.co.uk, https://admin.shopify.com, https://*.myshopify.com"
     (Fallback: ALLOWED_ORIGIN for a single origin.)
   Special:
     If list contains "*", allow all.
========================================================= */
function parseOrigins() {
  const raw = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS
    : (process.env.ALLOWED_ORIGIN || '');
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

const allowedOrigins = parseOrigins();

function isOriginAllowed(origin) {
  // No Origin header (curl, server-to-server, some sendBeacon navigations) => allow
  if (!origin) return true;

  // Not configured => open
  if (allowedOrigins.length === 0) return true;

  // Wildcard anywhere => open
  if (allowedOrigins.includes('*')) return true;

  let o;
  try { o = new URL(origin); } catch { return false; }

  return allowedOrigins.some(entry => {
    try {
      // If entry has protocol, treat as full origin
      if (/^https?:\/\//i.test(entry)) {
        const u = new URL(entry);
        // Exact origin match
        if (o.origin === u.origin) return true;

        // Wildcard subdomain like https://*.myshopify.com
        if (u.hostname.startsWith('*.') && o.protocol === u.protocol) {
          const suffix = u.hostname.slice(1); // ".myshopify.com"
          return o.hostname.endsWith(suffix);
        }
        return false;
      }

      // Domain-only wildcard like *.myshopify.com
      if (entry.startsWith('*.')) {
        const suffix = entry.slice(1); // ".myshopify.com"
        return o.hostname.endsWith(suffix);
      }

      // Bare hostname (no protocol) => host must match exactly (protocol-agnostic)
      return o.hostname === entry;
    } catch {
      return false;
    }
  });
}

const corsOptions = {
  origin(origin, cb) {
    if (isOriginAllowed(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Write-Key'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

/* =========================================================
   Security / Logging
========================================================= */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow CSV download
}));
app.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); });
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* =========================================================
   Body parsing (supports navigator.sendBeacon text/plain)
========================================================= */
app.use(express.json());
app.use(express.text({ type: 'text/plain' })); // sendBeacon default
app.use((req, res, next) => {
  if (req.is('text/plain') && typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch (_) { /* ignore */ }
  }
  next();
});

/* =========================================================
   Postgres (start even if DB not ready yet)
========================================================= */
let pool = null;
function createPoolIfPossible() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set yet – running without DB.');
    return null;
  }
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
    });
    return pool;
  } catch (e) {
    console.error('Failed to create DB pool:', e.message);
    pool = null;
    return null;
  }
}

async function initDb() {
  const p = createPoolIfPossible();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS search_events (
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        query TEXT,
        selected_text TEXT,
        label TEXT,
        dest_url TEXT,
        method TEXT,
        rank INT,
        matched_synonyms TEXT,
        source_path TEXT,
        user_agent TEXT,
        referrer TEXT,
        score NUMERIC
      );
    `);
    console.log('DB ready');
  } catch (err) {
    console.error('DB init failed:', err.message);
  }
}
initDb();
// Retry in case the DB finishes provisioning later
setInterval(initDb, 60 * 1000);

/* =========================================================
   Auth helpers
========================================================= */
function requireBasicAuth(req, res, next) {
  const user = process.env.EXPORT_USER;
  const pass = process.env.EXPORT_PASS;
  if (!user || !pass) {
    return res.status(503).type('text/plain').send('Export auth not configured');
  }
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Basic' && token) {
    const [u, p] = Buffer.from(token, 'base64').toString().split(':');
    if (u === user && p === pass) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Search Export"');
  return res.status(401).type('text/plain').send('Authentication required');
}

/* =========================================================
   Rate limits
========================================================= */
const ingestLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

/* =========================================================
   Health
========================================================= */
app.get('/healthz', (req, res) => res.json({ ok: true }));

/* =========================================================
   Ingest endpoint
   - Auth: lightweight write token via X-Write-Key header or body.writeKey
========================================================= */
app.post('/v1/log-search', ingestLimiter, async (req, res) => {
  const body = req.body || {};

  const configuredWriteKey = process.env.WRITE_KEY || process.env.TRACKING_SECRET || '';
  const providedKey = req.header('X-Write-Key') || body.writeKey || '';
  if (configuredWriteKey && providedKey !== configuredWriteKey) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const p = createPoolIfPossible();
  if (!p) return res.status(503).json({ error: 'DB not ready' });

  const payload = {
    query: (body.query || '').toString().slice(0, 2000),
    selected_text: (body.selected_text || '').toString().slice(0, 2000),
    label: (body.label || '').toString().slice(0, 200),
    dest_url: (body.dest_url || '').toString().slice(0, 2000),
    method: (body.method || '').toString().slice(0, 50),
    rank: Number.isFinite(body.rank) ? body.rank : null,
    matched_synonyms: Array.isArray(body.matched_synonyms)
      ? body.matched_synonyms.join(', ').slice(0, 2000)
      : (body.matched_synonyms || '').toString().slice(0, 2000),
    source_path: (body.source_path || '').toString().slice(0, 2000) || req.header('Referer') || '',
    user_agent: (body.user_agent || req.header('User-Agent') || '').toString().slice(0, 2000),
    referrer: (body.referrer || '').toString().slice(0, 2000),
    score: typeof body.score === 'number' ? body.score : null,
  };

  try {
    await p.query(
      `INSERT INTO search_events
       (query, selected_text, label, dest_url, method, rank, matched_synonyms, source_path, user_agent, referrer, score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        payload.query,
        payload.selected_text,
        payload.label,
        payload.dest_url,
        payload.method,
        payload.rank,
        payload.matched_synonyms,
        payload.source_path,
        payload.user_agent,
        payload.referrer,
        payload.score,
      ]
    );
    // 204: no body, good for sendBeacon
    return res.status(204).end();
  } catch (err) {
    console.error('Insert failed:', err.message);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   CSV export (password required)
========================================================= */
app.get('/export.csv', exportLimiter, requireBasicAuth, async (req, res) => {
  const p = createPoolIfPossible();
  if (!p) return res.status(503).type('text/plain').send('DB not ready');

  const filename = `search-events-${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const headers = [
    'id','ts','query','selected_text','label','dest_url','method','rank',
    'matched_synonyms','source_path','user_agent','referrer','score'
  ];
  res.write(headers.join(',') + '\n');

  try {
    const { rows } = await p.query('SELECT ' + headers.join(',') + ' FROM search_events ORDER BY ts DESC');
    for (const r of rows) {
      const row = headers.map((h) => {
        const val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
        // CSV-escape values with commas, quotes or newlines
        if (/[",\n]/.test(val)) return '"' + val.replace(/"/g, '""') + '"';
        return val;
      }).join(',');
      res.write(row + '\n');
    }
    res.end();
  } catch (err) {
    console.error('Export failed:', err.message);
    res.status(500).end('error');
  }
});

/* =========================================================
   Stats (password required)
   GET /stats?days=7 (1..90)
========================================================= */
app.get('/stats', exportLimiter, requireBasicAuth, async (req, res) => {
  const p = createPoolIfPossible();
  if (!p) return res.status(503).json({ error: 'DB not ready' });

  let days = parseInt(req.query.days, 10);
  if (!Number.isFinite(days)) days = 7;
  days = Math.min(Math.max(days, 1), 90); // clamp 1..90

  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [
      totalEvents,
      uniqueQueries,
      topQueries,
      topDests,
      byLabel,
      byMethod,
      avgRank,
      byDay
    ] = await Promise.all([
      p.query('SELECT COUNT(*)::int AS n FROM search_events WHERE ts >= $1', [start]),
      p.query('SELECT COUNT(DISTINCT query)::int AS n FROM search_events WHERE ts >= $1', [start]),
      p.query(`SELECT query, COUNT(*)::int AS n, MAX(ts) AS latest
               FROM search_events WHERE ts >= $1
               GROUP BY query ORDER BY n DESC NULLS LAST LIMIT 10`, [start]),
      p.query(`SELECT dest_url, COUNT(*)::int AS n
               FROM search_events WHERE ts >= $1
               GROUP BY dest_url ORDER BY n DESC NULLS LAST LIMIT 10`, [start]),
      p.query(`SELECT COALESCE(label,'') AS label, COUNT(*)::int AS n
               FROM search_events WHERE ts >= $1
               GROUP BY label ORDER BY n DESC`, [start]),
      p.query(`SELECT COALESCE(method,'') AS method, COUNT(*)::int AS n
               FROM search_events WHERE ts >= $1
               GROUP BY method ORDER BY n DESC`, [start]),
      p.query(`SELECT ROUND(AVG(rank)::numeric, 2) AS avg_rank
               FROM search_events WHERE ts >= $1 AND rank IS NOT NULL`, [start]),
      p.query(`SELECT to_char(ts::date,'YYYY-MM-DD') AS day, COUNT(*)::int AS n
               FROM search_events WHERE ts >= $1
               GROUP BY day ORDER BY day`, [start]),
    ]);

    // Fill any missing days in the timeseries
    const series = {};
    for (const r of byDay.rows) series[r.day] = r.n;
    const filled = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      filled.push({ day: key, n: series[key] || 0 });
    }

    res.json({
      since: start.toISOString(),
      days,
      totals: {
        events: totalEvents.rows[0].n,
        unique_queries: uniqueQueries.rows[0].n,
        avg_rank: avgRank.rows[0].avg_rank === null ? null : Number(avgRank.rows[0].avg_rank),
      },
      top_queries: topQueries.rows.map(r => ({ query: r.query || '', count: r.n, latest: r.latest })),
      top_destinations: topDests.rows.map(r => ({ dest_url: r.dest_url || '', count: r.n })),
      by_label: byLabel.rows.map(r => ({ label: r.label, count: r.n })),
      by_method: byMethod.rows.map(r => ({ method: r.method, count: r.n })),
      by_day: filled
    });
  } catch (err) {
    console.error('Stats failed:', err.message);
    res.status(500).json({ error: 'stats error' });
  }
});

/* =========================================================
   Root
========================================================= */
app.get('/', (req, res) => {
  res.type('text/plain').send('search-logger: POST /v1/log-search, GET /export.csv (auth), GET /stats (auth), GET /healthz');
});

app.listen(PORT, () => console.log(`search-logger listening on ${PORT}`));
