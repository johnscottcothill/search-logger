const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS ---
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: function (origin, cb) {
    // Allow same-origin or non-browser clients (no Origin header)
    if (!origin || allowedOrigin === '*' || origin === allowedOrigin) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Write-Key'],
}));

// --- Security/Logging ---
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --- Body parsing ---
app.use(express.json());
app.use(express.text({ type: 'text/plain' })); // for navigator.sendBeacon default
app.use((req, res, next) => {
  // If text/plain arrived from sendBeacon, try to parse JSON
  if (req.is('text/plain') && typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch (_) {}
  }
  next();
});

// --- Postgres (allow startup even if DB not ready yet) ---
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

// Try to init now and then every minute (in case Postgres finishes provisioning later)
initDb();
setInterval(initDb, 60 * 1000);

// Rate limit just the ingest endpoint
const ingestLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

// Health check (does not depend on DB)
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Ingest endpoint
app.post('/v1/log-search', ingestLimiter, async (req, res) => {
  const body = req.body || {};

  // Public write key (not truly secret in client-side JS). Fallback to TRACKING_SECRET env name.
  const configuredWriteKey = process.env.WRITE_KEY || process.env.TRACKING_SECRET || '';
  const providedKey = req.header('X-Write-Key') || body.writeKey || '';
  if (configuredWriteKey && providedKey !== configuredWriteKey) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  // Ensure DB available
  const p = createPoolIfPossible();
  if (!p) return res.status(503).json({ error: 'DB not ready' });

  const payload = {
    query: (body.query || '').toString().slice(0, 2000),
    selected_text: (body.selected_text || '').toString().slice(0, 2000),
    label: (body.label || '').toString().slice(0, 200),
    dest_url: (body.dest_url || '').toString().slice(0, 2000),
    method: (body.method || '').toString().slice(0, 50),
    rank: Number.isFinite(body.rank) ? body.rank : null,
    matched_synonyms: Array.isArray(body.matched_synonyms) ? body.matched_synonyms.join(', ').slice(0, 2000) : (body.matched_synonyms || '').toString().slice(0, 2000),
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
    return res.status(204).end();
  } catch (err) {
    console.error('Insert failed:', err.message);
    return res.status(500).json({ error: 'DB error' });
  }
});

// CSV export endpoint
app.get('/export.csv', async (req, res) => {
  const p = createPoolIfPossible();
  if (!p) return res.status(503).type('text/plain').send('DB not ready');

  const filename = `search-events-${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const headers = ['id','ts','query','selected_text','label','dest_url','method','rank','matched_synonyms','source_path','user_agent','referrer','score'];
  res.write(headers.join(',') + '\n');

  try {
    const { rows } = await p.query('SELECT ' + headers.join(',') + ' FROM search_events ORDER BY ts DESC');
    for (const r of rows) {
      const row = headers.map((h) => {
        const val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
        // CSV escape
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

// Root – tiny docs
app.get('/', (req, res) => {
  res.type('text/plain').send('search-logger: POST /v1/log-search, GET /export.csv, GET /healthz');
});

// Start the server regardless of DB state
app.listen(PORT, () => console.log(`search-logger listening on ${PORT}`));
