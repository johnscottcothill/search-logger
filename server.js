js
}


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
await pool.query(
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
// 204 so sendBeacon doesn’t wait for a body
return res.status(204).end();
} catch (err) {
console.error('Insert failed:', err);
return res.status(500).json({ error: 'DB error' });
}
});


// CSV export endpoint
app.get('/export.csv', async (req, res) => {
const filename = `search-events-${new Date().toISOString().slice(0,10)}.csv`;
res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);


const headers = ['id','ts','query','selected_text','label','dest_url','method','rank','matched_synonyms','source_path','user_agent','referrer','score'];
res.write(headers.join(',') + '\n');


try {
const { rows } = await pool.query('SELECT ' + headers.join(',') + ' FROM search_events ORDER BY ts DESC');
for (const r of rows) {
const row = headers.map((h) => {
const val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
// CSV escape: wrap in quotes if contains comma, quote or newline; double-up quotes
if (/[",\n]/.test(val)) return '"' + val.replace(/"/g, '""') + '"';
return val;
}).join(',');
res.write(row + '\n');
}
res.end();
} catch (err) {
console.error('Export failed:', err);
res.status(500).end('error');
}
});


// Root – tiny docs
app.get('/', (req, res) => {
res.type('text/plain').send('search-logger: POST /v1/log-search, GET /export.csv, GET /healthz');
});


init()
.then(() => app.listen(PORT, () => console.log(`search-logger listening on ${PORT}`)))
.catch((e) => {
console.error('Init failed', e);
process.exit(1);
});
