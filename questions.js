'use strict';
const fs = require('fs');
const path = require('path');
const GroqModule = require('groq-sdk');
const Groq = GroqModule.Groq || GroqModule.default || GroqModule;

const LANGUAGE_NAMES = {
    en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', ja: 'Japanese',
    da: 'Danish', nl: 'Dutch', fi: 'Finnish', ko: 'Korean', no: 'Norwegian', pt: 'Portuguese',
    sv: 'Swedish', 'zh-hans': 'Simplified Chinese', 'zh-hant': 'Traditional Chinese', ar: 'Arabic',
    bg: 'Bulgarian', cs: 'Czech', el: 'Greek', hi: 'Hindi', hu: 'Hungarian', id: 'Indonesian',
    he: 'Hebrew', lv: 'Latvian', lt: 'Lithuanian', pl: 'Polish', ru: 'Russian', ro: 'Romanian',
    sk: 'Slovak', sl: 'Slovenian', sr: 'Serbian', uk: 'Ukrainian', tr: 'Turkish', ca: 'Catalan',
    hr: 'Croatian', vi: 'Vietnamese', th: 'Thai'
};

function questionPrompt(languageName) {
    var L = languageName;
    var lines = [];
    if (L) {
        lines.push('Turn a search keyword into exactly one natural-sounding question, the way a native speaker of ' + L + ' would type it into a search engine or ask an AI assistant.');
        lines.push('');
        lines.push('OUTPUT LANGUAGE (mandatory): This instruction is written in English, but every question you write MUST be written in ' + L + '.' + (L === 'English' ? '' : ' Never write a question in English or in any other language.'));
        lines.push('If a keyword is in another language, still write the question in ' + L + ' and keep brand names, product names and other proper nouns unchanged.');
    } else {
        lines.push('Turn a search keyword into exactly one natural-sounding question, the way a native speaker of the keyword\'s language would type it into a search engine or ask an AI assistant.');
        lines.push('');
        lines.push('OUTPUT LANGUAGE (mandatory): This instruction is written in English, but every question MUST be written in the same language as its keyword. Never translate it into English.');
    }
    var LL = L || 'the language of the keyword';
    lines.push('');
    lines.push('Rules:');
    lines.push('1. Preserve the original search intent completely.');
    lines.push('2. Do not add new facts, assumptions or restrictions.');
    lines.push('3. Use idiomatic, grammatically correct ' + LL + '.');
    lines.push('4. Prefer a precise, short question.');
    lines.push('5. Return only the question, without explanation.');
    lines.push('6. If the input already is a naturally phrased question in ' + LL + ', return it unchanged.');
    lines.push('');
    lines.push('Batch processing: you receive a JSON array of objects {"id": number, "keyword": text}.');
    lines.push('Apply rules 1 to 4 and 6 to each keyword on its own.');
    lines.push('Rule 5 applies in batch mode like this: answer only with a JSON object of the form {"items": [{"id": number, "question": text}, ...]}, without Markdown and without any other text. The field "question" contains only the question, written in ' + LL + '.');
    lines.push('Return exactly one object in "items" for every id you received and use exactly the ids you received.');
    if (L) lines.push('Reminder: all questions must be in ' + L + '.' + (L === 'English' ? '' : ' The language of these instructions is English, but that is not the language of your answer.'));
    return lines.join('\n');
}

const BRAND_PROMPT = [
    'Classify each SEO keyword by brand mentions.',
    '',
    'ALLOWED_BRAND: {{BRAND}}',
    '',
    'Return:',
    '0 = No brand is mentioned.',
    '1 = One or more brands are mentioned, but ALLOWED_BRAND is absent.',
    '2 = ALLOWED_BRAND is mentioned, even alongside other brands.',
    '',
    'Recognize brands from all industries, including companies,',
    'products, services, platforms, and commercial trademarks.',
    '',
    'Recognize aliases, common abbreviations and spelling variations.',
    'Do not treat generic product terms as brands.',
    'Use context to resolve ambiguous names.'
].join('\n');

// Used when the page sends no brand (the normal case): any brand counts, only 0 and 1 are used.
const BRAND_PROMPT_ANY = [
    'Classify each SEO keyword by brand mentions.',
    '',
    'Return:',
    '0 = No brand is mentioned. The keyword consists only of generic words (product types, features, materials, places, test or review words, numbers, years).',
    '1 = At least one brand is mentioned (any company, product line, service, platform, shop, publication or commercial trademark).',
    'Never answer 2.',
    '',
    'Recognize brands from all industries, including companies,',
    'products, services, platforms, and commercial trademarks.',
    '',
    'Recognize aliases, common abbreviations and spelling variations.',
    'Do not treat generic product terms as brands.',
    'Use context to resolve ambiguous names.'
].join('\n');

const BRAND_BATCH_RULES = [
    '',
    'Batch mode: you receive a JSON array of objects {"id": number, "keyword": text}. Classify every keyword on its own.',
    'Instead of "Return only a JSON array of integers", answer only with a JSON object {"items": [{"id": number, "brand": 0 or 1 or 2}, ...]}, without markdown and without any other text.',
    'Return exactly one object per received id and use exactly the received ids. No explanations.'
].join('\n');

const MODES = ['questions', 'brands'];
const PER_ITEM_TOKENS = { questions: 45, brands: 16 };

const LEARN_TTL = 10 * 60 * 1000;
const MAX_TRIES = 4;
const MAX_FAILS = 8;
const MIN_BATCH = 10;
const OUT_CAP = 32000;

module.exports = function (env, rootDir) {
    const USAGE_FILE = path.join(rootDir, '.groq-usage.json');
    const LOG_DIR = path.join(rootDir, 'logs');
    const LOG_FILE = path.join(LOG_DIR, 'questions-errors.log');

    function cfg() {
        var models = (env.GROQ_MODELS || 'openai/gpt-oss-120b')
            .split(',').map(function (m) { return m.trim(); }).filter(Boolean);
        return {
            key: env.GROQ_API_KEY || '',
            models: models,
            model: env.GROQ_MODEL || models[0],
            batch: Math.max(MIN_BATCH, parseInt(env.GROQ_BATCH || '80', 10) || 80),
            batchBrands: Math.max(MIN_BATCH, parseInt(env.GROQ_BATCH_BRANDS || '150', 10) || 150),
            dailyLimit: parseInt(env.GROQ_DAILY_LIMIT || '1000', 10) || 1000,
            reasoning: (env.GROQ_REASONING || 'low').toLowerCase(),
            maxTokens: parseInt(env.GROQ_MAX_TOKENS || '', 10) || OUT_CAP,
            base: env.GROQ_BASE_URL || undefined,
            minGap: parseInt(env.GROQ_MIN_INTERVAL_MS || '2000', 10),
            tpm: parseInt(env.GROQ_TPM || '8000', 10),
            timeout: parseInt(env.GROQ_TIMEOUT_MS || '600000', 10),
            retryScale: parseFloat(env.GROQ_RETRY_SCALE || '1') || 1
        };
    }

    function configError() {
        return cfg().key ? null : 'Missing env var: GROQ_API_KEY';
    }

    var client = null, clientKey = '';
    function getClient(c) {
        var id = c.key + '|' + (c.base || '');
        if (!client || clientKey !== id) {
            client = new Groq({ apiKey: c.key, baseURL: c.base, maxRetries: 0, timeout: c.timeout });
            clientKey = id;
        }
        return client;
    }

    function today() { return new Date().toISOString().slice(0, 10); }
    function readUsage() {
        try {
            var u = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
            if (u.date === today()) return { date: u.date, count: u.count || 0, tokens: u.tokens || 0 };
        } catch (e) {  }
        return { date: today(), count: 0, tokens: 0 };
    }
    function writeUsage(u) {
        try { fs.writeFileSync(USAGE_FILE, JSON.stringify(u)); } catch (e) {  }
    }

    function logError(rec) {
        rec.time = new Date().toISOString();
        try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
            fs.appendFileSync(LOG_FILE, JSON.stringify(rec) + '\n');
        } catch (e) { console.error('questions: cannot write log:', e.message); }
        return rec;
    }

    var learnedBatch = {};
    var learnedAt = {};
    var okStreak = 0;
    var running = false;
    var lastCall = 0;
    var dropped = {};

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    var tokenWindow = [];
    var lastTotal = 0;
    var learnedTpm = 0;
    function windowTokens() {
        var cut = Date.now() - 60000;
        tokenWindow = tokenWindow.filter(function (e) { return e.t > cut; });
        return tokenWindow.reduce(function (s, e) { return s + e.n; }, 0);
    }
    async function tpmGuard(c) {
        var limit = learnedTpm || c.tpm;
        var need = lastTotal || 3000;
        if (!limit || need >= limit * 0.9) return;
        for (var i = 0; i < 30; i++) {
            if (windowTokens() + need <= limit * 0.95 || !tokenWindow.length) return;
            var pw = Math.min(60000, Math.max(300, tokenWindow[0].t + 60000 - Date.now() + 250));
            live.waiting = { kind: 'pacing', until: Date.now() + pw, reason: 'the tokens-per-minute limit of the plan' };
            await sleep(pw);
            live.waiting = null;
        }
    }

    async function pace(gap) {
        var wait = lastCall + gap - Date.now();
        if (wait > 0) await sleep(wait);
        lastCall = Date.now();
    }

    function headerOf(e, name) {
        var h = e && e.headers;
        if (!h) return null;
        return typeof h.get === 'function' ? h.get(name) : (h[name] || null);
    }

    function waitFromMessage(msg) {
        var m = /try again in\s+((?:\d+(?:\.\d+)?\s*(?:ms|d|h|m|s)\s*)+)/i.exec(msg || '');
        if (!m) return 0;
        var unit = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
        var ms = 0, re = /(\d+(?:\.\d+)?)\s*(ms|d|h|m|s)/gi, t;
        while ((t = re.exec(m[1]))) ms += parseFloat(t[1]) * unit[t[2].toLowerCase()];
        return Math.ceil(ms) + 500;
    }

    function nextUtcMidnight() {
        var d = new Date();
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    }

    function classifyProblem(kind, status, msg) {
        msg = String(msg || '');
        if (kind === 'daily') {
            if (/^Daily request limit reached/.test(msg)) return { type: 'daily_local', status: status || null, message: msg, resetAt: nextUtcMidnight() };
            var w = waitFromMessage(msg);
            return { type: 'daily_groq', status: status || 429, message: msg, scope: /\(TPD\)|tokens per day/i.test(msg) ? 'tokens' : 'requests', waitMs: w || null, resetAt: w ? null : nextUtcMidnight() };
        }
        if (status === 401 || status === 403) return { type: 'auth', status: status, message: msg };
        if (status === 404) return { type: 'model', status: status, message: msg };
        if (status === 413) return { type: 'too_large', status: status, message: msg };
        if (status === 429) return { type: 'rate', status: status, message: msg, waitMs: waitFromMessage(msg) || null };
        if (status === 400) return { type: 'bad_request', status: status, message: msg };
        if (!status && /^timeout/i.test(msg)) return { type: 'server', status: null, message: msg };
        if (!status) return { type: 'network', status: null, message: msg };
        if (status >= 500 || status === 408) return { type: 'server', status: status, message: msg };
        return { type: 'other', status: status, message: msg };
    }

    var live = { running: false, mode: null, waiting: null };

    async function callLLM(c, model, items, task) {
        var u = readUsage();
        if (u.count >= c.dailyLimit)
            return { kind: 'daily', message: 'Daily request limit reached (' + u.count + '/' + c.dailyLimit + ' requests today, GROQ_DAILY_LIMIT); resets 00:00 UTC' };
        await tpmGuard(c);
        await pace(c.minGap);
        u = readUsage(); u.count++; writeUsage(u);

        var body = {
            model: model,
            temperature: 0.2,
            max_completion_tokens: Math.min(c.maxTokens, 800 + items.length * task.perItem),
            stream: false,
            messages: [
                { role: 'system', content: task.system },
                { role: 'user', content: JSON.stringify(items) }
            ]
        };
        if (!dropped.response_format) body.response_format = { type: 'json_object' };
        if (!dropped.reasoning_effort && c.reasoning !== 'off') body.reasoning_effort = c.reasoning;
        if (!dropped.include_reasoning) body.include_reasoning = false;

        var completion;
        try {
            completion = await getClient(c).chat.completions.create(body);
        } catch (e) {
            var status = e && e.status;
            if (!status) {
                var timedOut = (Groq.APIConnectionTimeoutError && e instanceof Groq.APIConnectionTimeoutError) || /timed? ?out/i.test(e && e.message);
                return { kind: 'retry', status: 0, shrink: timedOut, message: (timedOut ? 'timeout after ' + c.timeout + ' ms' : 'network error: ' + (e && e.message)), wait: 5000 };
            }
            var eb = e.error && (e.error.error || e.error);
            var msg = (eb && eb.message) || e.message || ('HTTP ' + status);
            var lim = /Limit\s+(\d+),\s*Requested\s+(\d+)/i.exec(msg);
            if (lim && /\(TPM\)|tokens per minute/i.test(msg)) learnedTpm = Number(lim[1]);

            if (status === 400) {
                var names = ['response_format', 'reasoning_effort', 'include_reasoning'];
                for (var i = 0; i < names.length; i++) {
                    if (body[names[i]] !== undefined && msg.indexOf(names[i]) !== -1) {
                        dropped[names[i]] = true;
                        return { kind: 'retry', status: status, noTry: true, message: names[i] + ' rejected, retrying without it: ' + msg, wait: 0 };
                    }
                }
                return { kind: 'fatal', status: status, message: msg };
            }
            if (status === 413 || (status === 429 && lim && Number(lim[2]) > Number(lim[1]))) {
                var ratio = lim ? Number(lim[1]) / Number(lim[2]) : 0.5;
                return { kind: 'retry', status: status, shrinkRatio: Math.min(0.5, ratio * 0.8), message: msg, wait: 1000 };
            }
            if (status === 429) {
                if (/per day|\(TPD\)|\(RPD\)/i.test(msg)) return { kind: 'daily', status: status, message: msg };
                var ra = parseFloat(headerOf(e, 'retry-after'));
                var w = (ra > 0 ? ra * 1000 + 500 : 0) || waitFromMessage(msg) || 10000;
                return { kind: 'retry', status: status, message: msg, wait: Math.min(w, 120000), fixedWait: true };
            }
            if (status === 408 || status === 504 || status === 524)
                return { kind: 'retry', status: status, shrink: true, message: msg, wait: 8000 };
            if (status >= 500)
                return { kind: 'retry', status: status, message: msg, wait: 8000 };
            return { kind: 'fatal', status: status, message: msg };
        }
        var choice = (completion.choices && completion.choices[0]) || {};
        var usage = completion.usage || {};
        var tu = readUsage(); tu.tokens += (usage.total_tokens || 0); writeUsage(tu);
        if (usage.total_tokens) { tokenWindow.push({ t: Date.now(), n: usage.total_tokens }); lastTotal = usage.total_tokens; }
        return {
            kind: 'ok',
            text: (choice.message && choice.message.content) || '',
            finish: choice.finish_reason || null,
            usage: usage
        };
    }

    function parseAnswer(text) {
        var objs = null;
        var clean = String(text || '').replace(/```(?:json)?/gi, '');
        var start = clean.search(/\[\s*\{/), end = clean.lastIndexOf(']');
        if (start !== -1 && end > start) {
            try { objs = JSON.parse(clean.slice(start, end + 1)); } catch (e) { objs = null; }
        }
        var parseFailed = false;
        if (!Array.isArray(objs)) {
            parseFailed = true;
            objs = [];
            var re = /\{(?:[^{}"]|"(?:[^"\\]|\\.)*")*\}/g, m;
            while ((m = re.exec(clean))) {
                try { var o2 = JSON.parse(m[0]); if (o2 && o2.id !== undefined) objs.push(o2); } catch (e) {  }
            }
        }
        var seen = {}, map = {}, dup = [];
        objs.forEach(function (o) {
            if (!o || typeof o !== 'object') return;
            var id = Number(o.id);
            var q = typeof o.question === 'string' ? o.question.replace(/[‐‑]/g, '-').replace(/\s+/g, ' ').trim() : '';
            var b;
            if (typeof o.brand === 'number' || (typeof o.brand === 'string' && /^\s*[012]\s*$/.test(o.brand))) b = Number(o.brand);
            if (b !== 0 && b !== 1 && b !== 2) b = undefined;
            if (!Number.isInteger(id) || (!q && b === undefined)) return;
            var sig = q + '|' + (b === undefined ? '' : b);
            if (seen[id] === undefined) { seen[id] = sig; map[id] = { q: q || undefined, b: b }; }
            else if (seen[id] !== sig) { dup.push(id); }
        });
        dup.forEach(function (id) { delete map[id]; });
        return { map: map, dup: dup, parseFailed: parseFailed };
    }

    async function run(rawKeywords, requestedModel, opts) {
        opts = opts || {};
        var c = cfg();
        var model = requestedModel || c.model;
        if (c.models.indexOf(model) === -1) {
            var bad = new Error('Model not allowed: ' + model + ' (allowed: ' + c.models.join(', ') + ')');
            bad.status = 400; throw bad;
        }
        var mode = opts.mode === undefined || opts.mode === null ? 'questions' : opts.mode;
        if (MODES.indexOf(mode) === -1) { var bm = new Error('Unknown mode: ' + JSON.stringify(mode) + ' (allowed: ' + MODES.join(', ') + ')'); bm.status = 400; throw bm; }
        var lang = '', languageName = null;
        if (opts.lang !== undefined && opts.lang !== null && opts.lang !== '') {
            lang = String(opts.lang).toLowerCase();
            languageName = LANGUAGE_NAMES[lang] || null;
            if (!languageName) { var bg = new Error('Unknown language: ' + JSON.stringify(opts.lang)); bg.status = 400; throw bg; }
        }
        var brand = '';
        if (opts.brand !== undefined && opts.brand !== null) {
            if (typeof opts.brand !== 'string') { var bb = new Error('brand must be a string'); bb.status = 400; throw bb; }
            brand = opts.brand.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (brand.length > 80) { var bl = new Error('brand is too long (max 80 characters)'); bl.status = 400; throw bl; }
        }
        if (running) { var b = new Error('A question/brand run is already running'); b.status = 409; throw b; }
        running = true;
        live = { running: true, mode: mode, waiting: null };
        try {
            var wantB = mode !== 'questions';
            var system = mode === 'questions' ? questionPrompt(languageName)
                : (brand ? BRAND_PROMPT.replace('{{BRAND}}', brand) : BRAND_PROMPT_ANY) + '\n' + BRAND_BATCH_RULES;
            var task = { system: system, perItem: PER_ITEM_TOKENS[mode] };
            var maxBatch = mode === 'questions' ? c.batch : c.batchBrands;
            var lbKey = model + '|' + mode;

            var seen = {}, items = [], skippedSingle = 0, skippedLong = 0, skippedInvalid = 0;
            (rawKeywords || []).forEach(function (raw) {
                if (typeof raw !== 'string') { skippedInvalid++; return; }
                var k = raw.trim().replace(/\s+/g, ' ');
                if (!k || seen[k]) return;
                seen[k] = true;
                var multi = k.split(' ').length >= 2;
                if (!multi && mode === 'questions') { skippedSingle++; return; }
                if (k.length > 300) { skippedLong++; return; }
                items.push({ id: items.length + 1, keyword: k, tries: 0, needQ: mode === 'questions', needB: wantB });
            });
            var isComplete = function (it) { return (!it.needQ || it.q !== undefined) && (!it.needB || it.b !== undefined); };
            var payload = function (it) { return { id: it.id, keyword: it.keyword }; };

            var questions = {}, brands = {}, failed = [], errors = [], fatal = null;
            var totals = { requests: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0 };
            var pending = items.slice();
            var failStreak = 0;
            var problem = null, lastRetry = null;
            if (learnedAt[lbKey] && Date.now() - learnedAt[lbKey] > LEARN_TTL) { delete learnedBatch[lbKey]; delete learnedAt[lbKey]; }
            var size = Math.min(learnedBatch[lbKey] || maxBatch, maxBatch);

            var note = function (rec) {
                rec.model = model;
                rec.task = mode;
                rec.batchSize = size;
                errors.push(logError(rec));
            };
            var dropExhausted = function () {
                pending = pending.filter(function (it) {
                    if (it.tries >= MAX_TRIES) { failed.push(it.keyword); return false; }
                    return true;
                });
            };

            while (pending.length && !fatal) {
                var batch = pending.slice(0, size);
                var r = await callLLM(c, model, batch.map(payload), task);
                totals.requests++;

                if (r.kind === 'fatal' || r.kind === 'daily') {
                    fatal = r.message;
                    problem = classifyProblem(r.kind, r.status, r.message);
                    note({ kind: r.kind, status: r.status || null, message: r.message, keywords: batch.length });
                    break;
                }
                if (r.kind === 'retry') {
                    if (!r.noTry) failStreak++;
                    if (r.shrinkRatio && batch.length > MIN_BATCH)
                        size = Math.max(MIN_BATCH, Math.floor(batch.length * r.shrinkRatio));
                    else if (r.shrink && batch.length > MIN_BATCH)
                        size = Math.max(MIN_BATCH, Math.floor(batch.length / 2));
                    learnedBatch[lbKey] = size; learnedAt[lbKey] = Date.now(); okStreak = 0;
                    note({ kind: 'retry', status: r.status, message: r.message, keywords: batch.length, attempt: failStreak });
                    lastRetry = classifyProblem('retry', r.status, r.message);
                    if (failStreak >= MAX_FAILS) {
                        fatal = 'Too many failed requests in a row (' + failStreak + '): ' + r.message;
                        problem = Object.assign({}, lastRetry, { exhausted: true, attempts: failStreak });
                        note({ kind: 'fatal', message: fatal, keywords: pending.length });
                        break;
                    }
                    if (r.wait) {
                        var rw = Math.max(0, Math.round((r.fixedWait ? r.wait : r.wait * Math.max(1, failStreak)) * c.retryScale));
                        live.waiting = { kind: 'retry', until: Date.now() + rw, status: r.status || null, reason: lastRetry.type, message: r.message, attempt: failStreak, max: MAX_FAILS };
                        await sleep(rw);
                        live.waiting = null;
                    }
                    continue;
                }
                failStreak = 0;

                var uu = r.usage || {};
                totals.promptTokens += uu.prompt_tokens || 0;
                totals.completionTokens += uu.completion_tokens || 0;
                totals.reasoningTokens += (uu.completion_tokens_details && uu.completion_tokens_details.reasoning_tokens) || 0;

                var parsed = parseAnswer(r.text);
                var ids = {};
                batch.forEach(function (it) { ids[it.id] = it; });
                var truncated = r.finish === 'length';
                var willShrink = (truncated || parsed.parseFailed) && batch.length > MIN_BATCH;
                var got = 0, missing = [];
                batch.forEach(function (it) {
                    var e = parsed.map[it.id];
                    if (e) {
                        if (it.needQ && e.q) { it.q = e.q; questions[it.keyword] = e.q; }
                        if (it.needB && e.b !== undefined) { it.b = e.b; brands[it.keyword] = e.b; }
                    }
                    if (isComplete(it)) got++;
                    else { if (!willShrink) it.tries++; missing.push(it.id); }
                });
                var unknown = Object.keys(parsed.map).filter(function (id) { return !ids[id]; });
                pending = pending.filter(function (it) { return !isComplete(it); });

                if (truncated || parsed.parseFailed || missing.length || parsed.dup.length || unknown.length) {
                    note({
                        kind: truncated ? 'truncated' : (parsed.parseFailed ? 'parse' : 'missing'),
                        finish: r.finish, keywords: batch.length, received: got,
                        missing: missing.length, missingIds: missing.slice(0, 20),
                        duplicateIds: parsed.dup.slice(0, 20), unknownIds: unknown.slice(0, 20),
                        attempt: batch[0] && batch[0].tries,
                        completionTokens: uu.completion_tokens || null
                    });
                }
                if (willShrink) {
                    size = Math.max(MIN_BATCH, Math.floor(batch.length / 2));
                    learnedBatch[lbKey] = size; learnedAt[lbKey] = Date.now(); okStreak = 0;
                } else if (!missing.length) {
                    okStreak++;
                    if (okStreak >= 3 && size < maxBatch) { size = Math.min(maxBatch, size * 2); learnedBatch[lbKey] = size; learnedAt[lbKey] = Date.now(); okStreak = 0; }
                }
                dropExhausted();
            }

            pending.forEach(function (it) { failed.push(it.keyword); });
            var uf = readUsage();
            return {
                model: model,
                mode: mode,
                lang: lang || null,
                language: languageName,
                brand: brand,
                problem: problem,
                questions: questions,
                brands: brands,
                failed: failed,
                skipped: { singleWord: skippedSingle, tooLong: skippedLong, invalid: skippedInvalid },
                errors: errors.slice(0, 200),
                fatal: fatal,
                usage: totals,
                today: uf.count,
                tokensToday: uf.tokens,
                dailyLimit: c.dailyLimit,
                batch: size
            };
        } finally {
            running = false;
            live = { running: false, mode: null, waiting: null };
        }
    }

    function status() {
        var c = cfg(), u = readUsage();
        return {
            configured: !!c.key,
            error: c.key ? null : 'Missing env var: GROQ_API_KEY',
            model: c.model, models: c.models, batch: c.batch, batchBrands: c.batchBrands, reasoning: c.reasoning,
            today: u.count, tokensToday: u.tokens, dailyLimit: c.dailyLimit, resetAt: nextUtcMidnight(), live: live, logFile: 'logs/questions-errors.log'
        };
    }

    return { run: run, status: status, configError: configError, _parseAnswer: parseAnswer };
};
