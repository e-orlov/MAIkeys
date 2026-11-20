'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
} catch (e) {  }

const env = process.env;
const questions = require('./questions')(env, __dirname);
const PORT = parseInt(env.PORT || '3000', 10);
const HOST = env.HOST || '127.0.0.1';
const API_VERSION = env.GOOGLE_ADS_API_VERSION || 'v24';
const ADS = (env.GOOGLE_ADS_BASE_URL || 'https://googleads.googleapis.com') + '/' + API_VERSION;
const MAX_BATCH = 1000;
const MAX_SEEDS = 20;
const IDEAS_PAGE = 1000;

const LANGUAGES = {
    en: 1000, de: 1001, fr: 1002, es: 1003, it: 1004, ja: 1005, da: 1009, nl: 1010, fi: 1011,
    ko: 1012, no: 1013, pt: 1014, sv: 1015, 'zh-hans': 1017, 'zh-hant': 1018, ar: 1019,
    bg: 1020, cs: 1021, el: 1022, hi: 1023, hu: 1024, id: 1025, he: 1027, lv: 1028, lt: 1029,
    pl: 1030, ru: 1031, ro: 1032, sk: 1033, sl: 1034, sr: 1035, uk: 1036, tr: 1037,
    ca: 1038, hr: 1039, vi: 1040, th: 1044
};

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST',
    'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function configError() {
    var need = ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET',
        'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'];
    var missing = need.filter(function (k) { return !env[k]; });
    return missing.length ? 'Missing env vars: ' + missing.join(', ') : null;
}

var token = { value: null, exp: 0 };
async function accessToken() {
    if (token.value && Date.now() < token.exp - 60000) return token.value;
    var res = await fetch(env.GOOGLE_OAUTH_URL || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GOOGLE_ADS_CLIENT_ID,
            client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
            refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    });
    var j = await res.json();
    if (!res.ok) throw new Error('OAuth: ' + (j.error_description || j.error || res.status));
    token = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    return token.value;
}

async function adsPost(urlPath, body) {
    var customer = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
    var headers = {
        'Authorization': 'Bearer ' + await accessToken(),
        'Content-Type': 'application/json'
    };
    if (env.GOOGLE_ADS_DEVELOPER_TOKEN) headers['developer-token'] = env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
    var res = await fetch(ADS + '/customers/' + customer + urlPath, {
        method: 'POST', headers: headers, body: JSON.stringify(body)
    });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) {
        var msg = (j.error && (j.error.message || JSON.stringify(j.error.details || ''))) || res.status;
        var err = new Error('Google Ads API: ' + msg);
        err.status = res.status;
        throw err;
    }
    return j;
}

var geoCache = {};
async function geoTarget(country) {
    country = String(country || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return null;
    if (geoCache[country] !== undefined) return geoCache[country];
    var j = await adsPost('/googleAds:search', {
        query: "SELECT geo_target_constant.resource_name FROM geo_target_constant " +
            "WHERE geo_target_constant.country_code = '" + country + "' " +
            "AND geo_target_constant.target_type = 'Country' LIMIT 1"
    });
    var r = j.results && j.results[0];
    geoCache[country] = r ? r.geoTargetConstant.resourceName : null;
    return geoCache[country];
}

function validKeyword(k) {
    return k.length > 0 && k.length <= 80 && k.split(/\s+/).length <= 10 &&
        !/[@%,\\\[\]{}<>!?=+*^~`|;:"]/.test(k);
}

const micros = function (v) { return v !== undefined ? Number(v) / 1e6 : null; };
const sum = function (a) { return a.reduce(function (s, x) { return s + x; }, 0); };
const pct = function (a, b) {
    if (!a.length || a.length !== b.length) return null;
    var base = sum(b);
    return base > 0 ? Math.round((sum(a) - base) / base * 100) : null;
};

function metricsRow(m, h) {
    m = m || {}; h = h || {};
    var s = (h.monthlySearchVolumes || []).map(function (x) {
        return { y: Number(x.year), m: MONTHS.indexOf(String(x.month)), v: Number(x.monthlySearches || 0) };
    }).sort(function (a, b) { return a.y - b.y || a.m - b.m; }).map(function (x) { return x.v; });
    var n = s.length;
    return {
        volume: m.avgMonthlySearches !== undefined ? Number(m.avgMonthlySearches) : 0,
        cpc: micros(m.highTopOfPageBidMicros),
        cpcLow: micros(m.lowTopOfPageBidMicros),
        cpcAvg: micros(h.averageCpcMicros),
        competition: m.competitionIndex !== undefined ? Number(m.competitionIndex) : null,
        competitionLevel: m.competition || null,
        change3m: n >= 6 ? pct(s.slice(-3), s.slice(-6, -3)) : null,
        changeYoy: n >= 24 ? pct(s.slice(-12), s.slice(-24, -12)) : null,
        change3y: n >= 48 ? pct(s.slice(-12), s.slice(-48, -36)) : null,
        trend: s.join(',')
    };
}

function variantNames(r) {
    return [r.text].concat(r.closeVariants || []).map(function (n) { return String(n).toLowerCase(); });
}

function historyOptions() {
    var end = new Date(); end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() - 1);
    var start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 47);
    var ym = function (d) { return { year: d.getUTCFullYear(), month: MONTHS[d.getUTCMonth()] }; };
    return { includeAverageCpc: true, yearMonthRange: { start: ym(start), end: ym(end) } };
}

async function metricsFor(req, keywords) {
    var base = Object.assign({}, req, { keywords: keywords, keywordPlanNetwork: 'GOOGLE_SEARCH' });
    var hist = Object.assign({}, base, { historicalMetricsOptions: historyOptions() });
    var both = await Promise.all([
        adsPost(':generateKeywordHistoricalMetrics', base),
        adsPost(':generateKeywordHistoricalMetrics', hist)
    ]);
    var histBy = {};
    (both[1].results || []).forEach(function (r) { variantNames(r).forEach(function (n) { histBy[n] = r.keywordMetrics || {}; }); });
    var out = {};
    (both[0].results || []).forEach(function (r) {
        var row = metricsRow(r.keywordMetrics, histBy[String(r.text).toLowerCase()]);
        variantNames(r).forEach(function (n) { out[n] = row; });
    });
    return out;
}

async function geoLang(body) {
    var req = {};
    var geo = await geoTarget(body.country);
    if (geo) req.geoTargetConstants = [geo];
    var lang = LANGUAGES[String(body.lang || '').toLowerCase()];
    if (lang) req.language = 'languageConstants/' + lang;
    return req;
}

function conceptsOf(r) {
    var cs = (r.keywordAnnotations && r.keywordAnnotations.concepts) || [];
    return cs.map(function (c) {
        var g = c.conceptGroup || {};
        return { name: c.name === undefined ? '' : String(c.name), group: g.name === undefined ? '' : String(g.name), type: g.type && g.type !== 'UNSPECIFIED' ? String(g.type) : null };
    });
}

const MAX_CONCEPT_KEYS = 20000;
const SEED_STOP = {};
('wie wer wen wem wessen was wo wohin woher wann warum wieso weshalb weswegen wozu wofür welche welcher welches welchen welchem womit wodurch woran worauf woraus wobei wonach worüber worum worunter wovon wovor wogegen worin ' +
 'für mit ohne von bei und oder der die das ein eine einen kann ist sind hat gibt nach aus auf zum zur how what where when why which who the for with and near').split(' ').forEach(function (w) { SEED_STOP[w] = true; });
async function concepts(body) {
    var norm = function (raw) { return String(raw).trim().toLowerCase().replace(/\s+/g, ' '); };
    var seen = {}, wanted = {}, valid = [];
    (body.keywords || []).forEach(function (raw) {
        if (typeof raw !== 'string') return;
        var k = norm(raw);
        if (!k || seen[k]) return;
        seen[k] = true; wanted[k] = true;
        if (validKeyword(k)) valid.push(k);
    });
    var all = Object.keys(wanted);
    if (all.length > MAX_CONCEPT_KEYS) { var e0 = new Error('Max ' + MAX_CONCEPT_KEYS + ' keywords per request'); e0.status = 400; throw e0; }
    if (!all.length) return { seed: null, concepts: {}, covered: 0, seedResults: 0, nextPageToken: null };

    var skip = {};
    (Array.isArray(body.skipSeeds) ? body.skipSeeds : []).forEach(function (x) { if (typeof x === 'string') skip[norm(x)] = true; });
    var done = {};
    Object.keys(skip).forEach(function (k) { if (wanted[k]) done[k] = []; });
    var rest = valid.filter(function (k) { return !done[k]; });

    var seed = null, pageToken = null, continuing = false;
    if (typeof body.pageToken === 'string' && body.pageToken && typeof body.seed === 'string' && validKeyword(norm(body.seed))) {
        seed = norm(body.seed); pageToken = body.pageToken; continuing = true;
    } else if (rest.length) {
        var freq = {};
        rest.forEach(function (k) { var t = k.split(' ')[0]; freq[t] = (freq[t] || 0) + 1; });
        var cands = Object.keys(freq).filter(function (t) { return freq[t] >= 2 && t.length >= 3 && !SEED_STOP[t] && validKeyword(t) && !skip[t]; })
            .sort(function (x, y) { return freq[y] - freq[x] || x.length - y.length; });
        if (!body.keepOrder) rest.sort(function (x, y) { return x.split(' ').length - y.split(' ').length || x.length - y.length; });
        seed = cands[0] || rest[0];
    }
    if (!seed) {
        return { seed: null, concepts: done, covered: Object.keys(done).length, seedResults: 0, nextPageToken: null, noSeed: !Object.keys(done).length };
    }
    var req = await geoLang(body);
    var j = await adsPost(':generateKeywordIdeas', Object.assign({}, req, {
        keywordSeed: { keywords: [seed] },
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        pageSize: IDEAS_PAGE,
        keywordAnnotation: ['KEYWORD_CONCEPT']
    }, pageToken ? { pageToken: pageToken } : {}));
    var out = Object.assign({}, done), results = j.results || [], annotated = 0, fromCall = 0;
    results.forEach(function (r) {
        var key = String(r.text).toLowerCase();
        if (r.keywordAnnotations && r.keywordAnnotations.concepts && r.keywordAnnotations.concepts.length) annotated++;
        if (wanted[key] && !out[key] && key !== seed) { out[key] = conceptsOf(r); fromCall++; }
    });
    var seedRow = false;
    if (wanted[seed] && !out[seed]) { out[seed] = []; seedRow = true; }
    return { seed: seed, seedRow: seedRow, concepts: out, covered: Object.keys(out).length, fromCall: fromCall, seedResults: results.length, annotated: annotated,
        nextPageToken: j.nextPageToken || null, continuing: continuing, geo: req.geoTargetConstants ? req.geoTargetConstants[0] : null };
}

async function ideas(body) {
    var seen = {}, seeds = [];
    (body.keywords || []).forEach(function (raw) {
        if (typeof raw !== 'string') return;
        var k = raw.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!seen[k] && validKeyword(k)) { seen[k] = true; seeds.push(k); }
    });
    if (!seeds.length) return { results: {}, order: [], seeds: 0 };
    if (seeds.length > MAX_SEEDS) {
        var e = new Error('Max ' + MAX_SEEDS + ' seed keywords per request');
        e.status = 400;
        throw e;
    }
    var req = await geoLang(body);
    var j = await adsPost(':generateKeywordIdeas', Object.assign({}, req, {
        keywordSeed: { keywords: seeds },
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        pageSize: IDEAS_PAGE,
        keywordAnnotation: ['KEYWORD_CONCEPT']
    }));
    var rows = {}, order = [], toHist = [], conc = {};
    (j.results || []).forEach(function (r) {
        var key = String(r.text).toLowerCase();
        if (rows[key]) return;
        rows[key] = r.keywordIdeaMetrics || {};
        var cs = conceptsOf(r);
        if (cs.length || (seeds.length === 1 && r.keywordAnnotations)) conc[key] = cs;
        order.push(key);
        if (validKeyword(key)) toHist.push(key);
    });
    var hist = {};
    if (toHist.length) {
        var both = await adsPost(':generateKeywordHistoricalMetrics', Object.assign({}, req, {
            keywords: toHist, keywordPlanNetwork: 'GOOGLE_SEARCH', historicalMetricsOptions: historyOptions()
        }));
        (both.results || []).forEach(function (r) { variantNames(r).forEach(function (n) { hist[n] = r.keywordMetrics || {}; }); });
    }
    var results = {};
    order.forEach(function (k) { results[k] = metricsRow(rows[k], hist[k]); if (conc[k]) results[k].concepts = conc[k]; });
    return { results: results, order: order, seeds: seeds.length, more: !!j.nextPageToken };
}

async function volume(body) {
    var seen = {}, keywords = [], skipped = 0;
    (body.keywords || []).forEach(function (raw) {
        if (typeof raw !== 'string') { skipped++; return; }
        var k = raw.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen[k]) return;
        seen[k] = true;
        if (validKeyword(k)) keywords.push(k); else skipped++;
    });
    if (keywords.length > MAX_BATCH) {
        var e = new Error('Max ' + MAX_BATCH + ' keywords per request');
        e.status = 400;
        throw e;
    }
    var req = await geoLang(body);
    var geo = req.geoTargetConstants ? req.geoTargetConstants[0] : null;

    var results = keywords.length ? await metricsFor(req, keywords) : {};
    return { results: results, skipped: skipped, geo: geo || null, language: req.language || null };
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject' };
const PUBLIC = path.join(__dirname, 'public');

function json(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

function sameOrigin(req) {
    var origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

http.createServer(function (req, res) {
    handle(req, res).catch(function (e) {
        console.error('request error:', req.method, req.url && req.url.slice(0, 200), e);
        if (!res.headersSent) { try { json(res, 500, { error: 'Internal error' }); } catch (e2) {  } }
        else res.end();
    });
}).listen(PORT, HOST, function () {
    console.log('MAIkeys on http://' + HOST + ':' + PORT + '  (Google Ads API ' + API_VERSION + ')');
    var ce = configError();
    if (ce) console.log('Search volume disabled. ' + ce + ' (see .env.example)');
});

async function handle(req, res) {
    var url;
    try { url = new URL(req.url, 'http://x'); }
    catch (e) { res.writeHead(400); return res.end('Bad request'); }

    if (url.pathname === '/api/volume/status' && req.method === 'GET') {
        var ce = configError();
        return json(res, 200, { configured: !ce, error: ce, apiVersion: API_VERSION });
    }

    if (url.pathname.indexOf('/api/') === 0 && !sameOrigin(req)) {
        return json(res, 403, { error: 'Cross-origin request refused' });
    }

    if (url.pathname === '/api/volume/check' && req.method === 'GET') {
        var ce3 = configError();
        if (ce3) return json(res, 503, { ok: false, error: ce3 });
        try {
            await accessToken();
            var j = await adsPost('/googleAds:search', {
                query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1'
            });
            var c = j.results && j.results[0] && j.results[0].customer;
            return json(res, 200, { ok: true, oauth: true, customer: c || null });
        } catch (e) {
            return json(res, 200, { ok: false, error: e.message });
        }
    }

    if (url.pathname === '/api/questions/status' && req.method === 'GET') {
        return json(res, 200, questions.status());
    }

    if ((url.pathname === '/api/volume' || url.pathname === '/api/ideas' || url.pathname === '/api/concepts' || url.pathname === '/api/questions') && req.method === 'POST') {
        if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
            return json(res, 415, { error: 'Content-Type must be application/json' });
        }
        var chunks = [], size = 0;
        req.on('data', function (c) { size += c.length; if (size < 2e6) chunks.push(c); });
        req.on('end', async function () {
            try {
                if (size >= 2e6) return json(res, 413, { error: 'Body too large' });
                var isQ = url.pathname === '/api/questions';
                var ce2 = isQ ? questions.configError() : configError();
                if (ce2) return json(res, 503, { error: ce2 });
                var body;
                try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
                catch (pe) { return json(res, 400, { error: 'Invalid JSON body' }); }
                if (!body || typeof body !== 'object' || Array.isArray(body))
                    return json(res, 400, { error: 'Body must be a JSON object' });
                if (body.keywords !== undefined && !Array.isArray(body.keywords))
                    return json(res, 400, { error: 'keywords must be an array of strings' });
                var out = await (isQ ? questions.run(body.keywords, body.model, { mode: body.mode, brand: body.brand, lang: body.lang })
                    : url.pathname === '/api/ideas' ? ideas(body) : url.pathname === '/api/concepts' ? concepts(body) : volume(body));
                json(res, 200, out);
            } catch (e) {
                json(res, e.status && e.status < 600 ? e.status : 500, { error: e.message });
            }
        });
        return;
    }

    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    var rel;
    try { rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
    catch (e) { res.writeHead(400); return res.end('Bad request'); }
    if (rel.indexOf('\0') !== -1) { res.writeHead(400); return res.end('Bad request'); }
    var file = path.normalize(path.join(PUBLIC, rel));
    if (file.indexOf(PUBLIC) !== 0) { res.writeHead(403); return res.end(); }
    fs.readFile(file, function (err, data) {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
}
