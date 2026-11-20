# MAIkeys - The Bulk Keyword Tool

A bulk keyword research tool. It collects long-tail keywords from Google Suggest and similar services, adds search data from the Google Ads API (volume, CPC, competition, trend, keyword concepts), and uses an LLM on Groq Cloud to turn keywords into questions and to tell brand keywords from non-brand ones. Everything ends up in one sortable table that you can filter and export.

This is an extension of [wassname/keywordshitter2](https://github.com/wassname/keywordshitter2), which is an update of the original keywordshitter.com. The German defaults (country `de`, language `de`, German prefixes and suffixes) and the Google Ads, Groq and notice features are additions made for this project.

## Contents

1. [Quick start](#1-quick-start)
2. [Configuration (.env)](#2-configuration-env)
3. [The page: reference of all controls](#3-the-page-reference-of-all-controls)
4. [The results table](#4-the-results-table)
5. [Filters](#5-filters)
6. [Export](#6-export)
7. [Google Ads features](#7-google-ads-features)
8. [LLM features (Groq Cloud)](#8-llm-features-groq-cloud)
9. [Recommended workflows](#9-recommended-workflows)
10. [HTTP API reference](#10-http-api-reference)
11. [Messages and errors](#11-messages-and-errors)
12. [Known limitations and workarounds](#12-known-limitations-and-workarounds)
13. [Best practice for users](#13-best-practice-for-users)
14. [Files, logs, security, tests](#14-files-logs-security-tests)
15. [License and credits](#15-license-and-credits)

## 1. Quick start

You need Node.js 18 or newer (the server uses the built-in `fetch`; `package.json` says so in `engines`).

```bash
npm install
cp .env.example .env     # then edit .env, see chapter 2
npm start
```

Open http://127.0.0.1:3000/ in a browser. Do not open `public/index.html` as a file: the page needs the server for volume, ideas, concepts, questions and brand classes, and the notice box will tell you "The MAIkeys server is not reachable".

What works without any setup: the keyword collection from Google Suggest and the other suggest services, the table, the filters and the export. Google Ads data needs the four Google values in `.env`. Questions and brand classes need `GROQ_API_KEY`.

To check the Google Ads connection without spending quota on keywords, call `GET /api/volume/check`. It refreshes the OAuth token and reads your own customer row.

### Dependencies

On the server (Node.js):

- One package: `groq-sdk` (the official Groq client). `npm install` installs it, and nothing else is needed to run the server.
- Everything else comes with Node itself (`http`, `fs`, `path` and `fetch`). There is no web framework.
- `package.json` has no development packages and no build scripts. Only `npm start` (runs `node server.js`) and `npm run production` (the same with `NODE_ENV=production`) exist.

In the browser (loaded from CDNs when the page opens, nothing to install):

| Library | Version | Used for |
|---|---|---|
| jQuery | 2.2.0 | the page logic |
| Bootstrap (JavaScript) | 3.3.6 | the collapsible Advanced block |
| DataTables bundle | 1.10.10 with Buttons 1.1.0, ColReorder 1.3.0, FixedHeader 3.1.0, KeyTable 2.1.0, Responsive 2.0.0, Select 1.1.0, JSZip 2.5.0 | the results table, column menu, sorting, CSV export |
| lodash | 4.2.0 | helpers |
| FileSaver.js | 2014-11-29 | saving the CSV file |
| progress.js | 0.1.0 | the progress line under the header |
| Google Fonts | Inter, Space Grotesk | type of the theme |

The Bootstrap styles are not loaded from a CDN: they are compiled into `public/css/style.css` in this repository, and the theme in `public/css/mai-theme.css` sits on top of them. The page therefore needs internet access to open, and the keyword sources need it too (chapter 12).

## 2. Configuration (.env)

The file `.env` sits next to `server.js` and is not committed. Values set in the process environment win over the file. Restart the server after every change.

| Variable | Default | Meaning |
|---|---|---|
| `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` | none | OAuth credentials of the Google Ads account. All three are needed. |
| `GOOGLE_ADS_CUSTOMER_ID` | none | Account the calls run against, digits only (dashes are removed). |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | none | Only if you reach the account through a manager (MCC) account. |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | none | Deprecated and ignored by the API. Sent only if you set it. |
| `GOOGLE_ADS_API_VERSION` | `v24` | Version of the REST API. |
| `PORT`, `HOST` | `3000`, `127.0.0.1` | Where the server listens. Keep `HOST` on the loopback address (see chapter 14). |
| `GROQ_API_KEY` | none | Key for Groq Cloud. Without it the question and brand buttons report the missing key. |
| `GROQ_MODELS`, `GROQ_MODEL` | `openai/gpt-oss-120b` | Models the server accepts (comma separated) and the default. The model picker on the page appears only when there are several. |
| `GROQ_BATCH` | `80` | Keywords per request for questions. |
| `GROQ_BATCH_BRANDS` | `150` | Keywords per request for brand classes (short answers, so more fit). |
| `GROQ_DAILY_LIMIT` | `1000` | Requests per UTC day the server allows itself. |
| `GROQ_REASONING` | `low` | Reasoning effort of the gpt-oss models: `low`, `medium`, `high` or `off` (the parameter is not sent). |
| `GROQ_TPM` | `8000` | Tokens per minute of your plan. The server paces its requests to stay under it. `0` turns pacing off. |
| `GROQ_MIN_INTERVAL_MS` | `2000` | Minimum gap between two Groq requests (the free plan allows 30 per minute). |
| `GROQ_MAX_TOKENS` | `32000` | Upper bound for the answer size of one request. |
| `GROQ_TIMEOUT_MS` | `600000` | Time after which a Groq request counts as timed out. |
| `GROQ_RETRY_SCALE` | `1` | Multiplies the waits between retries. Used by tests, leave it alone. |
| `GROQ_BASE_URL`, `GOOGLE_ADS_BASE_URL`, `GOOGLE_OAUTH_URL` | real endpoints | Point the server at a mock for tests. Leave them unset. |

## 3. The page: reference of all controls

### Input and the main buttons

| Control | What it does |
|---|---|
| Input (large text box) | One seed keyword per line. Blank lines and repeated seeds are dropped. While a job runs, the box shows the queue: every query with a mark (a check mark when it returned suggestions, a cross when it returned none) followed by the results. The label above it ("Queue: N") counts queries plus results. |
| Do Keywords! / Stop doing | Starts the collection and becomes the stop button while it runs. With an empty input, the letters and question words are still expanded. |
| Advanced | Opens the settings panel (section below). |
| Reset | Stops everything that is running, empties Input, the table, all status lines and the notice box, and ignores responses that are still on the way. Settings are kept. |
| Get search volume | Looks up volume, CPC, competition, history and the change columns for the rows currently shown. Chapter 7.1. |
| Get concepts | Looks up Google keyword concepts for the rows currently shown. Chapter 7.3. While it runs the button says "Stop concepts". |
| Generate questions | Turns the shown keywords into questions in the language chosen in Advanced under Language. Chapter 8.1. While it runs the button says "Stop generating". |
| Model picker | Groq model for questions and brand classes. Hidden when only one model is configured. |
| Brand filter, brand field, Classify brands | The brand feature. Chapter 8.2. While it runs the button says "Stop classifying". |
| Notice box | The coloured box under the buttons that explains problems and waits. Chapter 11. |
| Status lines | Short grey lines for volume, concepts, questions and brands. |
| Errors box (collapsed) | Appears after the first Groq problem. Lists every Groq error of the session. "Copy log" copies it. The same lines go to `logs/questions-errors.log`. |

### Help icons

Next to every field of Input and Advanced there is a small round "i" icon: Seeds, the model picker (when it is shown), Brand filter, Brand, Include, Exclude, Concepts max requests, Service, Prefixes, Suffixes, Continuous running, the three "Ads ideas" fields (shown with the service "google ads ideas"), Country and Language. A click opens a short help text in English next to the icon: what the field does, the input format, the default and the pitfalls. A second click on the icon, a click anywhere else or the Escape key closes it. The texts are Bootstrap popovers and live in `public/js/help.js`, one entry per field, so they are easy to edit. The buttons and the table controls have no icon.

The header has links to Input, Results and About (the About text sits in the footer at the bottom of the page), and an Export button that jumps to the table and opens the export menu. It stays at the top while you scroll, and the thin lime line under it is the progress bar of a running collection.

The "Get ..." and "Generate ..." buttons work on the rows that are shown after Include/Exclude, the brand filter and the search box. "Classify brands" uses Include/Exclude only (chapter 8.2).

### Advanced settings

| Setting | Default | Effect |
|---|---|---|
| Include / Exclude | empty | Chapter 5.1. |
| Concepts: max Google requests per click | 20 | Cap for one click of "Get concepts" (1 to 200). |
| Service | google autosuggest | Where the keywords come from. The eight services are listed below. |
| Prefixes | 26 letters and 44 German question words | Words put before the seed. Comma separated. |
| Suffixes | 26 letters and 19 German words (kaufen, online, test, preis, ...) | Words put after the seed. Comma separated. |
| Continuous running | off | For suggest services, keeps running more rounds. For "google ads ideas", the ideas found become the seeds of the next round. |
| Ads ideas: max rounds | 2 | Rounds for "google ads ideas" (needs Continuous running). Round 1 is your seeds. |
| Ads ideas: stop at this many results | 5000 | The job stops when the table holds this many rows (counted after Include/Exclude). |
| Ads ideas: min. volume to become a seed | 0 | Ideas below this monthly volume stay in the table but are not expanded further. |
| Country, Language | de, de | Used by Google services, volume, ideas and concepts. Other suggest services ignore them. |
| Rate limit | 750 ms | Pause between queries. The field is hidden and disabled on purpose: lower values risk an IP ban at the suggest servers. |

The three "Ads ideas" fields are shown only when the service is "google ads ideas". Prefixes and suffixes are not used by that service.

### Services

The dropdown has eight entries, in this order. Google services come first, the rest follow alphabetically.

| Service | Source | Country, language | Notes |
|---|---|---|---|
| google ads ideas | Keyword Planner (`GenerateKeywordIdeas`) | used | Needs the Google Ads setup. Chapter 7.2. |
| google autosuggest | Google Suggest | used | The default. |
| google images | Google Suggest, images | used | Third-party endpoint, it can change without notice. |
| google news | Google Suggest, news | used | Same warning. |
| google shopping | Google Suggest, shopping | used | Same warning. |
| youtube | Google Suggest, YouTube | used | Same warning. |
| bing | Bing suggest | ignored | Answers only when the browser asks. A plain request from a terminal gets an empty reply, which is normal. |
| yahoo | Yahoo suggest | ignored | Same warning as the Google endpoints. |

All suggest services are called by the browser, not by the server, so they do not appear in chapter 10. Only "google ads ideas" goes through `POST /api/ideas`. The endpoints were checked on 2026-11-20 with a German keyword: all seven suggest endpoints answered, and Bing was also run through the page. "google ads ideas" was not part of that check.

Eleven other services of the original project were removed: nine because a check showed that they no longer answered, Yandex because its suggest script is refused when the browser loads it, and Baidu because it returns almost nothing for German keywords.

### Look and feel

The page uses a dark theme after the design of mai.mediaworx.com: a deep green background, cream text, one lime accent, pill buttons, rounded cards and a table with hairline cell borders. Fonts (Space Grotesk for headlines, Inter for text) load from Google Fonts. If the fonts cannot be loaded, the page falls back to system fonts. The scripts also come from CDNs, so the page needs internet access (chapter 12). The details are in `docs/design/mai-mediaworx-analysis.md`.

### What a suggest run does

For each seed the queue is: the seed itself, then every prefix followed by the seed, then the seed followed by every suffix. With one seed and the defaults that is 116 queries (1 + 70 prefixes + 45 suffixes). At the default rate of one query per 750 ms this takes about 90 seconds per seed. Each answer adds the returned suggestions as rows. Excluded terms are not queried. With Continuous running on, the results are queried again as new seeds until you press stop.

### Settings that are remembered

The browser keeps these in its local storage and restores them after a reload: service, country, language, prefixes, suffixes, Include, Exclude, Continuous running, the ideas fields, the concepts limit, brand name, brand filter state, and the table's column choices, sort order and search. The rows themselves are not stored. A reload empties the table, so export first.

## 4. The results table

The table has 20 columns. Only Keyword is visible at first. Volume, CPC and Competition appear when volume data arrives, Question when a question arrives, the three concept columns when concepts arrive. Everything else can be switched on in Column visibility.

| Column | Content |
|---|---|
| id | Running number of the row. |
| Keyword | The keyword as returned by the service, as plain text. |
| Length | Number of characters. |
| Volume | Average monthly searches over the last 12 months (Google Ads). |
| CPC (high bid), CPC (low bid) | Top-of-page bid, high and low range, in the currency of the account. |
| CPC (avg) | Average CPC over 48 months. It differs by up to 0.03 % between two calls, because Google's figure moves slightly. |
| Competition, Competition level | Index 0 to 100 and the class LOW, MEDIUM or HIGH (advertiser competition). |
| 3-month change % | Sum of the last 3 months against the 3 before. Growth carries a plus sign. |
| 12-month change % (YoY) | Last 12 months against the 12 before. |
| 3-year change % | Last 12 months against the same 12 months three years earlier. |
| Search | The query that produced the row (for example `a kaffeemaschine`). |
| Domain | The source of the suggestion (the suggest server address). |
| Words | Number of words. |
| Question | The question for the keyword, in the language chosen under Language (chapter 8.1). |
| Concepts (Google), Concept groups (Google), Concept group types | Google's keyword concepts (chapter 7.3). The three cells of a row list their values in the same order, separated by ` | `. |
| Monthly volume (48 mo, oldest first) | Comma separated monthly searches. It cannot be switched on in the table. It is always the last column of an export. |

Volume 0 or empty metrics mean that Keyword Planner has no data for the keyword, not that the lookup failed.

Other table controls: sorting by clicking a header, the Search box (searches all columns and also limits the export), the page length ("Show 25 rows", up to 800), and Column visibility.

Rows with the same keyword can appear more than once (the same suggestion comes back from several queries). Volume, questions and brand classes are requested once per unique keyword and written to every copy.

A wide table scrolls horizontally inside its card, on a narrow window too. Every column ticked in Column visibility stays on screen, nothing is collapsed, and the export contains exactly those columns.

## 5. Filters

### 5.1 Include and Exclude

Advanced, one term per line, case-insensitive substring match. Include keeps only keywords that contain at least one term. Exclude drops keywords that contain a term. Both apply to the table and to every export. Excluded keywords are also never queried or expanded further. Include does not shorten the query queue (a keyword that does not match can still lead to matching suggestions).

### 5.2 Brand filter

Three states, next to the buttons:

| State | Shows |
|---|---|
| All keywords | Everything (default). |
| Non-brand only | Keywords with brand class 0. |
| Only brand: X | Keywords with brand class 2 for the brand typed in the brand field. |

The classes come from "Classify brands" (chapter 8.2). Keywords without a class are hidden in the two brand states, and a line under the filter says how many are waiting. The filter combines with Include and Exclude (all must match). The classes are not shown as a column and are not exported. They only decide which rows are shown and exported.

## 6. Export

Button Export in the table toolbar:

| Item | Result |
|---|---|
| Copy | Copies the table to the clipboard as text. |
| CSV | Downloads a CSV file. |
| Copy keywords | Downloads a CSV with the Keyword column only, no header. |
| Copy visible columns | Downloads a CSV with the ticked columns, no header, no series column. |

(The last two also download a file despite their names.)

What an export contains:

- Only the rows that are shown: Include/Exclude, the brand filter and the Search box apply, in the current sort order, all pages.
- Every column ticked in Column visibility, in table order, followed by the 48-month series. The series is included even though it cannot be ticked.
- New lines inside a cell become spaces. HTML entities are decoded. Growth values carry a plus sign.

File name: `<seed>-<yyyymmddHHmmss>.csv`. The seed is the first seed keyword of the last run (the first line of Input if no run has happened), lower case, with `ä ö ü ß` written as `ae oe ue ss` and everything else that is not a letter or digit turned into `-`, cut to 60 characters. Without a seed the name starts with `keywords`.

## 7. Google Ads features

All of them go through the local server, so the credentials never reach the browser.

### 7.1 Search volume ("Get search volume")

Sends the unique shown keywords that have no volume yet, in batches of 1000. Per batch the server makes two calls to `generateKeywordHistoricalMetrics`: one with the default window (this gives Volume, the CPC range and competition) and one with a 48-month window (history, average CPC, the three change columns and the series). The status line shows "Fetching volume... done/total" and then "Volume loaded for N keywords".

Rules and limits of Keyword Planner:

- At most 80 characters, at most 10 words, none of these symbols: `@ % , \ [ ] { } < > ! ? = + * ^ ~ ` | ; : "`. Other keywords are skipped and counted: "(N skipped: invalid for Keyword Planner)".
- Google merges close variants (hyphen, dot, apostrophe, plural, spacing). The server hands the merged metrics to every spelling you sent. Because of that, two close spellings show the same volume, and the figure belongs to the group, not to one spelling. The count in "loaded for N keywords" can be higher than the number of unique keywords, because it also counts Google's canonical spellings.
- Country and language come from Advanced. Without a country the lookup runs without a geographic filter.

### 7.2 Ideas (service "google ads ideas")

Choose the service, write seed keywords in Input (up to 20 per request, more are sent in several requests), click Do Keywords!. Per request the server returns up to 1000 related keywords (the first page) with the same metrics as in 7.1. It makes one `generateKeywordIdeas` call and one history call. If Google has more ideas, the end of the run says so.

- With Continuous running, the ideas found become the seeds of the next round, up to "max rounds", "stop at this many results" and "min. volume to become a seed".
- New ideas are added to the table. Keywords already there are skipped, so you can run several seeds one after another.
- Idea lists contain keywords that Google has search data for. They are a different set than autosuggest results.

### 7.3 Keyword concepts ("Get concepts" and the ideas service)

Concepts are Google's annotation of a keyword: the concept (for example "tchibo"), the group it belongs to (for example "Marke"), and a group type: `BRAND` (brand of the seed), `OTHER_BRANDS`, `NON_BRAND`, or no type (shown as `-`). Google returns nothing else. Group names are in the language of the request.

Rules that shape the feature (all checked against the real API):

1. Concepts come only as an annotation of idea lists, never from the volume call.
2. Google fills the annotations only for requests with exactly one seed keyword. With two or more seeds they are empty.
3. The request's own seed keyword is never annotated.
4. An idea list has a limited length (about 3000 entries over three pages for a broad seed). Long-tail keywords, even with real volume, are often not in it.
5. Keywords with volume 0 are in no idea list.

What the page does with this:

- The ideas service with one seed fills the concept columns at once (999 of 1000 rows in a real test). With several seeds in one request the ideas arrive without concepts.
- "Get concepts" asks for the shown rows without concepts. Rows with volume 0 are skipped (the status line counts them). Each request uses one seed: the most frequent first word of the remaining keywords (question words, prepositions and words under three letters do not count), otherwise the remaining keyword with the highest volume. Every returned idea that is one of your rows gets its concepts, so a request usually covers many rows. A seed with more pages is continued while its pages still cover rows. The run stops at the request limit (Advanced) or after four requests in a row that covered no new row, and it says why. A row that had to serve as a seed stays empty and the page explains it.
- Rows without concepts are not asked again in the same session.
- The brand type of a concept is Google's view relative to the seed. It is unrelated to the LLM brand classes.

Real-test coverage: with autosuggest rows, between a quarter and a half of the rows with volume got concepts. With one seed in the ideas service nearly all did.

## 8. LLM features (Groq Cloud)

Both features use the same server-side client (the official `groq-sdk`, no hidden retries), the model `openai/gpt-oss-120b` by default, and the same safeguards. They need `GROQ_API_KEY`.

### 8.1 Questions ("Generate questions")

Turns each keyword of two or more words into one natural question in the language set under Language in Advanced (German by default). The instruction is an English prompt built in `questions.js` (`questionPrompt`). The page sends the chosen language code with the request, the server turns it into the language name (for example `fr` into French) and puts that name into the prompt. The prompt says in capital letters that it is written in English but that every question MUST be written in the chosen language, and it repeats this at the end. Real tests with German keywords gave German, English, French and Russian questions for the settings `de`, `en`, `fr` and `ru`. If a keyword is in another language than the setting, the question is still written in the chosen language and brand names stay unchanged. With the language field empty (or without `lang` in an API call) the question is written in the language of the keyword. The prompt is applied to every keyword on its own. A keyword that already is a question is returned unchanged. Single words are skipped (not an error). Keywords longer than 300 characters are skipped and reported.

The button works on the shown rows (after Include/Exclude, brand filter and search box) that have no question yet. The result goes to the Question column and into exports.

Measured cost: about 45 tokens per keyword in total (prompt, answer and reasoning), one request per 80 keywords by default.

### 8.2 Brand classes ("Classify brands")

You type the brand X in the brand field and click "Classify brands". Every keyword gets a class:

| Class | Meaning |
|---|---|
| 0 | No brand is mentioned. |
| 1 | One or more brands are mentioned, but X is not among them. |
| 2 | X is mentioned, alone or with other brands. |

The instruction is your classification prompt, verbatim, with X filled in (`BRAND_PROMPT` in `questions.js`). Only its output lines were adapted for batches: the keywords go in with IDs and the model answers `{"items":[{"id":1,"brand":0}, ...]}`. Brands from all industries count, including aliases, abbreviations and spelling variations. Generic product terms do not.

Behaviour:

- "Classify brands" takes every row that passes Include/Exclude, single words included ("tchibo" is the typical brand query). It ignores the brand filter itself, because otherwise unclassified rows could never be reached.
- A class is stored per row together with the brand it was computed for. If you change the brand, only the rows with class 1 or 2 are asked again, because class 0 is valid for any brand. The same brand with other capitalisation or spacing changes nothing.
- An empty brand field is allowed. The server then sends "(none)" and no row gets class 2.
- Brand classes are a separate request from questions on purpose. In a test with 104 labelled keywords the separate request was right 99.0 % of the time in both runs. A combined questions-plus-brands request was right only 98.1 % and 95.2 % of the time and missed brands such as PlayStation, Xbox and Windows. That is why the combined mode was removed.
- Measured cost: about 50 tokens per keyword (prompt, answer and reasoning), one request per 150 keywords by default.

Typical quality (real tests with about 550 classified keywords): class 2 was always correct. Misses were brand names split by a space ("v zug", "k fee", "l or"), and the treatment of shops (dm, aldi, media markt, amazon) and publications (Stiftung Warentest, Chip) is not consistent between runs. Check the class 0 list of an important keyword set by eye.

### 8.3 How the server makes the answers reliable

1. Every unique keyword gets an ID, and the model must answer exactly one item per ID in a JSON object.
2. The server checks every answer. Missing IDs, unknown IDs, duplicate IDs with different content, and values outside 0, 1, 2 are not accepted. Only the missing keywords are sent again. A keyword that gets no usable answer in 4 attempts is reported as failed.
3. A cut-off or unparsable answer halves the batch (never below 10 keywords) and keeps every complete item. A "request too large" answer (HTTP 413 or a token-limit 429 with "Limit X, Requested Y") sets the batch size from those numbers.
4. Rate limits: the server tracks the tokens of the last 60 seconds and waits before sending when the next request would exceed `GROQ_TPM`. If Groq still answers 429, the server waits for the time named in the answer (header or message) and tries again. Eight failed requests in a row stop the run.
5. A reduced batch size recovers after three clean requests per doubling and is forgotten after 10 minutes.
6. One run at a time: a second run gets HTTP 409.
7. Requests and tokens are counted per UTC day in `.groq-usage.json`. At `GROQ_DAILY_LIMIT` the server stops by itself.
8. If Groq rejects `response_format`, `reasoning_effort` or `include_reasoning`, the parameter is dropped and the request repeated.

While the server waits (pacing or retry), the page polls the status every two seconds and shows the wait in the notice box.

## 9. Recommended workflows

### A. Long-tail research from suggestions

1. Put one seed in Input (for example `kaffeemaschine`). Check country and language in Advanced.
2. Do Keywords!, wait for the run to finish (about 90 seconds per seed).
3. Include/Exclude: drop what you do not need, so that the next steps cost less.
4. Get search volume.
5. Optional: Get concepts (expect partial coverage).
6. Optional: type the brand, Classify brands, set the brand filter, Generate questions for the rows you keep.
7. Export.

### B. Complete data for one topic

1. Service google ads ideas, one general seed in Input, Continuous running off.
2. Do Keywords!. Rows arrive with volume, history and concepts.
3. Include/Exclude, Classify brands, Generate questions, Export.
4. Next topic: change the seed and run again. New ideas are added.

### C. Both sources

Run B first, then A with a related seed. The table then holds Google's idea keywords with full data and the long tail from suggestions. Press Get concepts to fill in what is possible for the long tail.

Spend LLM requests last, after Include/Exclude and the brand filter have reduced the table. Brand classes first, then questions only for the rows you keep.

## 10. HTTP API reference

The server listens on `HOST:PORT` and serves the page and these endpoints. POST bodies must be JSON with the header `Content-Type: application/json` (HTTP 415 otherwise), at most 2 MB (HTTP 413). Requests from another origin get HTTP 403. A malformed body gives 400 ("Invalid JSON body", "Body must be a JSON object", "keywords must be an array of strings"). Any unexpected error gives 500 `{"error":"Internal error"}`. Errors always have the form `{"error": "message"}`. Entries of `keywords` that are not strings are ignored.

### GET /api/volume/status

`{ "configured": true, "error": null, "apiVersion": "v24" }`. `configured` is false with a message when Google values are missing.

### GET /api/volume/check

Refreshes the OAuth token and reads the customer row. `{ "ok": true, "oauth": true, "customer": { "id", "descriptiveName", "currencyCode" } }`. On failure `{ "ok": false, "error": "..." }` (HTTP 200) or 503 when values are missing.

### POST /api/volume

Request: `{ "keywords": [...], "country": "de", "lang": "de" }`, at most 1000 keywords (more gives 400). Response: `{ "results": { "<keyword>": { "volume", "cpc", "cpcLow", "cpcAvg", "competition", "competitionLevel", "change3m", "changeYoy", "change3y", "trend" } }, "skipped": N, "geo", "language" }`. Keys are lower case, with whitespace collapsed. Invalid keywords are counted in `skipped`.

### POST /api/ideas

Request: `{ "keywords": [seeds], "country", "lang" }`, at most 20 seeds (more gives 400). Response: `{ "results": { "<idea>": { ...same fields as above..., "concepts": [...] } }, "order": [idea order], "seeds": N, "more": true|false }`. `more` is true when Google has further pages. `concepts` is present when Google returned concepts (with one seed, an empty array means "none"). With several seeds it is absent.

### POST /api/concepts

Request: `{ "keywords": [...], "country", "lang", "skipSeeds": [...], "keepOrder": true|false, "seed": "...", "pageToken": "..." }`, up to 20000 keywords. The server makes one single-seed ideas request (the seed is chosen as described in 7.3; `seed` and `pageToken` together continue a seed on its next page). Response: `{ "seed", "seedRow", "concepts": { "<keyword>": [ { "name", "group", "type" } ] }, "covered", "fromCall", "seedResults", "annotated", "nextPageToken", "continuing", "geo" }`. `type` is `BRAND`, `OTHER_BRANDS`, `NON_BRAND` or null. `noSeed: true` means that no valid seed was left. Keywords that were already used as seeds (`skipSeeds`) are answered with an empty list without a Google request.

### POST /api/questions

Request: `{ "keywords": [...], "model": "...", "mode": "questions" | "brands", "brand": "X", "lang": "de" }`. `mode` defaults to questions. `lang` is a language code from the Language list (for example `en`, `de`, `fr`, `zh-hans`) and sets the language of the questions. Empty or missing means the language of each keyword. An unknown code gives 400. In brands mode it has no effect. `brand` is a string of at most 80 characters (line breaks and control characters are flattened). Unknown mode, model outside `GROQ_MODELS`, or a non-string brand give 400. A parallel run gives 409.

Response: `{ "model", "mode", "lang", "language", "brand", "questions": { "<keyword>": "..." }, "brands": { "<keyword>": 0|1|2 }, "failed": [keywords], "skipped": { "singleWord", "tooLong", "invalid" }, "errors": [...], "fatal": null | "message", "problem": null | { "type", "status", "message", "waitMs"?, "resetAt"?, "scope"?, "exhausted"?, "attempts"? }, "usage": { "requests", "promptTokens", "completionTokens", "reasoningTokens" }, "today", "tokensToday", "dailyLimit", "batch" }`.

`fatal` and `problem` are set when the run stopped early. In that case `failed` lists the keywords that were not processed, and everything received before the stop is in `questions` or `brands`. Problem types: `daily_local`, `daily_groq`, `rate`, `server`, `network`, `auth`, `model`, `too_large`, `bad_request`, `other`.

### GET /api/questions/status

`{ "configured", "error", "model", "models", "batch", "batchBrands", "reasoning", "today", "tokensToday", "dailyLimit", "resetAt", "live": { "running", "mode", "waiting": null | { "kind": "pacing"|"retry", "until", "status", "reason", "message", "attempt", "max" } }, "logFile" }`. `resetAt` is the next 00:00 UTC in milliseconds. The page polls it during runs.

### Everything else

GET serves files from `public/`. Other methods answer 405 (so `HEAD /` gives 405, which does not matter in normal use).

## 11. Messages and errors

Problems show up in the notice box (red for things you must fix, yellow for waits and partial results, blue for information). Every box has the parts "What happened", "How long" and "What to do", a progress line (how many keywords were done before the stop), and a collapsed "Technical details" with the original message. The results received before a problem stay in the table. Press the same button again to continue: only the missing rows are sent.

### Groq and LLM

| Title in the box | Cause | What to do |
|---|---|---|
| Daily request limit reached (N of M ...) | The server's own counter reached `GROQ_DAILY_LIMIT`. No request was sent. | Wait for 00:00 UTC (the box shows the time), or raise `GROQ_DAILY_LIMIT` if your Groq account has more. |
| Groq daily limit reached (requests or tokens per day) | Groq refused: the daily quota of the plan is used up. | Wait for the time Groq names, or use a paid plan. |
| Groq is rate-limiting requests (HTTP 429) | Per-minute limit. The server already retried 8 times. | Wait 1 to 2 minutes and press again. If it keeps happening, lower `GROQ_BATCH` and `GROQ_BATCH_BRANDS`. |
| Groq is not answering properly (HTTP 5xx or timeout) | Problem on Groq's side, or a request that took too long. | Wait a few minutes and press again. Lower `GROQ_BATCH` if it repeats. |
| The server cannot reach Groq | Network, VPN, proxy or firewall. | Check the connection, then press again. |
| Groq rejected the API key (HTTP 401 or 403) | Key wrong, revoked or not allowed for the model. | Put a valid key into `.env`, restart the server, reload the page. |
| The Groq model is not available (HTTP 404) | The model name in `GROQ_MODEL` or `GROQ_MODELS` is wrong. | Correct it (default `openai/gpt-oss-120b`), restart. |
| Request too large for Groq even in the smallest batch (HTTP 413) | One request exceeds the size limit of the plan. | Lower `GROQ_BATCH` and `GROQ_BATCH_BRANDS`. Very long keywords can cause this. |
| Groq refused the request (HTTP 400) | A setting the model does not accept. | Read "Technical details" and `logs/questions-errors.log`. |
| N keywords got no usable answer | The model skipped or garbled these keywords in 4 attempts. | Press the button again (only these are retried). If the same ones fail again, skip them or lower the batch size. |
| N keywords were skipped | Keywords over 300 characters are not sent. | Shorten or remove them. |
| Groq is busy: retrying automatically (yellow, live) | A 429 or a server error. The box shows the attempt (x of 8) and the time to the next one. | Nothing. Keep the page open. |
| Waiting N s (normal, nothing to do) (blue, live) | Pacing to stay under the tokens-per-minute limit. | Nothing. |
| Finished, after N automatic retries | The run succeeded after temporary errors. | Nothing. |

### Google Ads

| Title in the box | Cause | What to do |
|---|---|---|
| Google Ads is not configured on the server | One of the Google values in `.env` is missing. | Fill them in, restart, reload. |
| Google rejected the credentials (OAuth, HTTP 401 or 403) | Refresh token expired or revoked, wrong client values, or no access to the customer. | Create a new refresh token, update `.env`, restart. |
| Google Ads is rate-limiting requests (HTTP 429) | Too many requests or the daily quota of Keyword Planner. | Wait a few minutes (the next day for a daily quota). Rows already loaded stay. |
| Google Ads refused the request (HTTP 400) | Invalid request, for example odd keywords. | Check country, language and keywords. Details are in the box. |
| Google Ads did not answer properly (HTTP 5xx) | Outage or timeout at Google. | Wait a few minutes and press again. |
| N keywords still without concepts (request limit of this click reached) | The cap of "Get concepts" was reached. | Press the button again, or raise the cap in Advanced. |
| N keywords stay without concepts: further requests would not help | Four requests in a row found none of the remaining keywords. They are not in the idea lists of the seeds. | Nothing. Use the ideas service with a general seed for better coverage. |
| Done. N keywords stay without concepts | Rows that had to be used as seeds are never annotated. | Nothing, or add a more general keyword to the table. |
| Google returned no concepts | No annotations exist for these keywords, country and language. | Try a more specific seed or another market. |
| N keywords cannot be looked up | Only keywords that Keyword Planner rejects remain. | Nothing to fix. |

### The server and the page

| Title or text | Cause | What to do |
|---|---|---|
| The MAIkeys server is not reachable | The server is stopped or crashed, or the page was opened as a file. | Export what you need if the table is still on screen, then `npm start` and open http://127.0.0.1:3000/. |
| Another Groq run is already active (HTTP 409) | Another tab or an earlier run is still going. | Wait until it ends. |
| Groq is not configured on the server (HTTP 503) | `GROQ_API_KEY` is missing. | Add it to `.env`, restart, reload. |
| The server refused the request (HTTP 413, 415, 403 and others) | Body too large, wrong content type, or another origin. | Reload the page and try again. |

Status lines worth knowing: "Nothing to look up (all filtered rows already have volume)", "Nothing to look up (all filtered rows already have concepts)", "Nothing to look up: ... have search volume 0", "Nothing to classify: no filtered keywords without a current brand class", "Nothing to generate: no filtered keywords with 2+ words and without a question", "Google Ads ideas: enter at least one seed keyword in the input field", "Google Ads ideas finished: N results", "Google Ads ideas: stopped at N results". They are information, not errors.

## 12. Known limitations and workarounds

| Limitation | Workaround |
|---|---|
| The rows are only in memory. Reload or closing the tab loses them. | Export before leaving. Column choices, filters and settings survive a reload. |
| The same keyword can appear several times in the table and in exports (about 12 % of the rows in a real test). | Remove duplicates in the spreadsheet. Requests to Google and Groq already use unique keywords. |
| Keywords with volume 0 (40 to 45 percent of the autosuggest results in the real tests) get no volume data and no concepts. | This is Keyword Planner's coverage. Use them as they are, or filter them out with the table sort. |
| Concepts for autosuggest rows are only partial. | Use the ideas service with one general seed (workflow B). |
| Concepts need single-seed requests, so ideas rounds with Continuous running bring no concepts after round 1. | Keep Continuous off for the ideas service, or run "Get concepts" afterwards. |
| One ideas request returns 1000 ideas at most (the first page). | Use several more specific seeds. |
| Close variants share one volume. | Treat the figure as the group's volume. |
| The brand filter hides rows that were not classified yet, and brand classes are not exported. | Classify first, then filter. Classes are not in the file: export the three states separately if you need the split. |
| LLM classification is not perfect: split brand names, shops and publications. Questions can add a small assumption, and a noun may be written in lower case. | Review class 0 for your important brands. Keep questions as drafts, not as final copy. |
| Groq's free plan limits per minute and per day. The server cannot see Groq's daily token limit, only its own counters. | Keep the batch sizes, filter before asking, and watch the status line ("requests today N/1000"). |
| Keywords starting with `=`, `+`, `-` or `@` are exported as they are. A spreadsheet may read such a cell as a formula. | Import the CSV as text, or prefix those cells. |
| The 48-month series cannot be ticked in the table. | It is always the last column of the export. |
| Suggest services other than Google can change or disappear. Country and language apply to Google only. | Prefer Google autosuggest. |
| `HEAD /` answers 405. | Irrelevant for normal use. |
| MAIkeys needs an internet connection for two things. The page loads jQuery, Bootstrap JavaScript, DataTables, lodash, FileSaver, progress.js and the fonts from CDNs, so without a connection it does not start. And the data comes from the internet: your browser calls the suggest services (Google, Bing, Yahoo) directly, and the local server calls Google Ads and Groq. Without a connection nothing can be collected. | Work with a connection. Local copies of the libraries would let the page open offline, but they would not bring the keyword sources back, so offline use makes no sense. |
| Several exports in the same second get the same file name. | The browser adds a number. |
| The file name uses the seed of the last run only. | Rename the file if the table mixes several seeds. |

## 13. Best practice for users

- Check the setup once: open `/api/volume/check` and watch the status of the two features (the page tells you about a missing key at the first click).
- Start small. Run a short seed first, look at the table, and only then spend Google and Groq requests.
- Narrow the table before you spend LLM requests: Include/Exclude first, then volume, then brand classes, then questions for the rows you keep.
- Classify brands before you generate questions. Then you can limit the questions to non-brand or brand rows with the brand filter.
- Let waits run. A blue or yellow live notice means the server is pacing or retrying. Do not reload the page during a run.
- After a stop (limit, rate limit, error), read the box, wait as it says, and press the same button again. Nothing is lost and nothing is sent twice.
- Keep the table until the export has been downloaded. Export all three brand states if you need them.
- Do not lower the rate limit of the suggest services, and do not run several tabs against the same Groq key (the second run gets 409).
- Check quality by sampling: a few dozen question and brand rows are enough to see whether the settings work for your topic.
- Restart the server after editing `.env`.

## 14. Files, logs, security, tests

| Path | Purpose |
|---|---|
| `server.js` | The local server: static files, Google Ads calls and the Groq endpoints. No dependencies besides Node. |
| `questions.js` | Groq client: prompts, ID scheme, retries, pacing, counters, error log. |
| `public/` | The page (`index.html`, `js/main.js`, `js/suggestions.js`, `js/help.js`, styles). |
| `public/js/help.js` | The texts of the "i" help popovers, one entry per field, and the code that adds the icons. |
| `public/css/mai-theme.css` | The dark theme (colors, type, buttons, cards, table, notices). It loads after `css/style.css` and only restyles classes; change the tokens at the top of the file to change the look. |
| `LICENSE` | The MIT licence text. |
| `package.json`, `package-lock.json` | The package `maikeys` with its single dependency `groq-sdk` and the start scripts. |
| `src/less/` | The source of the Bootstrap theme that was compiled into `public/css/style.css`. It is not needed to run the tool, and it cannot be rebuilt here: the Bootstrap 3 less sources it imports are not part of the repository, and `package.json` has no build script. |
| `docs/design/` | Analysis of the reference design (`mai-mediaworx-analysis.md`) the theme was built from. |
| `.env` | Your settings (not committed). |
| `.groq-usage.json` | Groq requests and tokens of the current UTC day (not committed). |
| `logs/questions-errors.log` | One JSON line per Groq problem (time, model, task, kind, status, message, batch size). Not committed. |
| `docs/e2e-test-2026-11-20.md` | Report of the end-to-end test with real keywords: runs, defects found and fixed, odd events, quality notes. |
| `docs/prerelease-test-2026-11-20.md` | Report of the last test before publishing: repository hygiene, clean install, all suggest services, a full run with real Google Ads and Groq keys, export check, failure notices, layout. |

Security: the server binds to `127.0.0.1` by default and rejects requests whose `Origin` differs from its own host (HTTP 403). POST requests need a JSON content type, so other sites cannot send them from a browser form. The body size is limited to 2 MB. File paths are checked against `public/`. Text from third parties (keywords, questions, concepts) is written into the table escaped. Secrets stay in `.env` and are never sent to the browser. Do not expose the server to a network: it has no login, and it spends your Google and Groq quota.

Tests: the project has no automated test suite in the repository. The checks done so far (mock servers for Groq and Google Ads, a regression run against the real server, and the end-to-end run with real data) are summarised in `docs/e2e-test-2026-11-20.md`.

## 15. License and credits

MIT licence, see the file `LICENSE`. The original project declared MIT in its `package.json` but shipped no licence file. Contributions are welcome.

- [blakamia for being the reason we can't have nice things, and for creating the original keywordshitter](http://www.blackhatworld.com/blackhat-seo/black-hat-seo-tools/538215-free-simple-longtail-keyword-tool.html)
- wassname, for the second generation.
