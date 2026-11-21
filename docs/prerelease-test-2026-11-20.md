# Pre-release test, 2026-11-20

Real browser (built-in browser pane), real Google Ads and Groq keys, real Google, Bing and Yahoo endpoints. Server started from the project folder with the real `.env`, on port 3990.

## Result

All planned areas passed. Three small defects were found and fixed during the run. Open points are listed at the end.

## 1. Repository hygiene

| Check | Result |
|---|---|
| `.env`, `.groq-usage.json`, `logs/` are ignored by git | pass (`git check-ignore`) |
| None of them is tracked | pass |
| Values from `.env` appear in no other file (exact search of every value of 12 characters or more) | pass |
| Key patterns (`gsk_`, `AIza`, `1//`, `ya29.`) in the tree | none found |
| `.env.example` has only names | pass |

## 2. Clean install

Copy of the project without `node_modules`, `.env`, `.git`, logs and usage counter.

- `npm install` added 1 package, 0 vulnerabilities.
- Server starts and prints which features are disabled.
- Status endpoints answer 200 or 503 with the missing variable names.
- In the browser, with no keys: suggestions work (66 rows); "Get search volume", "Get concepts", "Generate questions" and "Classify brands" each show a notice that names the missing values and what to do.

## 3. Suggest services (browser, real endpoints)

Seed `wasserkocher`, two prefixes, two suffixes, one run per service, one script at a time.

| Service | Rows | Notice |
|---|---|---|
| google | 61 | none |
| google images | 61 | none |
| google news | 46 | none |
| google shopping | 16 | none |
| youtube | 32 | none |
| bing | 38 | none |
| yahoo | 13 | none |

Baidu and Yandex are no longer in the dropdown (8 entries remain).

## 4. Full run with real keys

Seeds `wasserkocher` and `kaffeemaschine`, Google autosuggest, 6 prefixes, 5 suffixes.

| Step | Result |
|---|---|
| Collection | 326 rows in 19 s |
| Get search volume | 326 keywords in about 1 s, 325 with volume, 1 skipped (invalid for Keyword Planner) |
| Get concepts | 34 of 184 keywords covered in 9 requests, 142 keywords with volume 0 skipped. This is the known limit of concepts on autosuggest rows. |
| Generate questions | 324 of 324 generated, 0 failed, 6 requests, about 136 s, including a visible pacing notice |
| Classify brands (brand "Bosch") | 326 of 326 classified, 0 failed, 3 requests, about 131 s. Classes: 279 non-brand, 46 other brand, 1 brand "Bosch". |

## 5. Filters and export

- Brand filter: All 326, Non-brand 279, Only brand 1.
- Include `kaufen`: 41 rows. Plus Exclude `online`: 33 rows. No row violates either rule.
- CSV export with the filters on: header plus 33 rows, exactly the ticked columns plus the 48-month series.
- CSV export with all 20 columns visible and no filters: 326 rows, no duplicates. 5216 cell values (all 16 data columns of every row) compared with the table data: 0 differences (a leading `+` in the change columns is formatting only).
- File name from the page: `wasserkocher-20261120134156`, the first seed plus the time stamp, `.csv` is added by the download.
- Two rows without a question: `cafémaschine` and `kaffeemaschinen` (single words, skipped by design).

## 6. Failures

| Case | Result |
|---|---|
| Invalid Groq key | notice "Groq rejected the API key (HTTP 401)" with cause, duration ("will not fix itself") and the steps to take |
| Invalid Google refresh token | notice "Google rejected the credentials (OAuth)" with the same three parts |
| Server stopped | notice "The MAIkeys server is not reachable" on volume, questions and concepts; suggestions kept working because the browser calls them directly |
| Cross-origin POST | 403 |
| Wrong content type | 415 |
| Invalid JSON | 400 |
| Body over 2 MB | 413 |
| 1001 keywords | 400 |
| Unknown mode, unknown model | 400 |
| HEAD and POST on `/` | 405 |
| Path traversal (`../.env`, `%2e%2e`, `/.env`, `..%5c`) | 404, 404, 404, 403 |
| Keys in status responses | none |

## 7. Layout

- 375 px: no horizontal scroll, header and footer readable, fonts Inter and Space Grotesk loaded.
- Footer with the merged About text: readable, link visible. Desktop: the "About" link in the header scrolls to the footer.
- Console: no errors in the clean runs. Two failed Google News requests were logged during an earlier run that I aborted by reloading the page.

## Defects found and fixed during the run

1. The pacing notice read "to stay within staying within the tokens-per-minute limit". Fixed in `questions.js`.
2. The "server not reachable" notice always said to open `http://127.0.0.1:3000/`. It now uses the address of the current page. Fixed in `public/js/main.js`.
3. The link in the footer sat directly under the text. A 12 px margin was added in `public/css/mai-theme.css`.

Re-check in the browser after the fixes, with real keys: the pacing notice now reads "to stay within the tokens-per-minute limit of the plan" (about 30 notices over one run, counting down from 56 s to 1 s). With the server stopped, the "not reachable" notice says to open `http://localhost:3990/`, the address of the page. The page also loads and starts without the Analytics snippet: no request to Google Analytics, no failed resources, no console errors, `KWS` initialised.

## Not covered

- Tablet width and widths above 1440 px.
- Google Ads ideas through the page (checked in the earlier E2E report).
- Several hundred queries in a row against Bing and Yahoo, to find their limits.
- Groq daily-limit and rate-limit notices with the real API (covered with a mock earlier).

## Observations

- A rejected Groq request (invalid key) still raises the local "requests today" counter by one.
- With two seeds the export file name uses the first seed only.
- Done after the test: the Deno workflow of the original project was deleted, `git remote origin` now points to `e-orlov/MAIkeys`, and the Google Analytics snippet was removed from `public/index.html`.

## Changes after the test: question language

- The question prompt is now English and takes the language from the Language setting (`questionPrompt` in `questions.js`). The page sends `lang` with the request; the server maps the code to a language name and rejects unknown codes with 400. The prompt states that it is written in English but that every question MUST be written in the chosen language.
- Real Groq test through the API with four German keywords: `de` gave German, `en` English, `fr` French, `ru` Russian questions, 0 failed in each run. Empty language gave German (the language of the keywords). An unknown code gave 400.
- Real test through the page with Language set to English: 162 questions, none in German.
- The dropdown entry "Filipino" was removed: it had the code `fi` (Finnish), so it sent the wrong language to Google Ads and to the prompt.

### All languages of the dropdown

Real Groq test through the API, three German keywords per language, all 37 entries of the Language list (`en` to `vi`). Result: 37 of 37 requests answered with HTTP 200, 0 failed keywords, every question was written in the chosen language. For the 13 languages with their own script (Arabic, Hebrew, Hindi, Thai, Japanese, Korean, both Chinese variants, Russian, Bulgarian, Ukrainian, Serbian, Greek) a script check passed for every question. The Latin-script languages were read by eye.

Quality notes (not language errors): Vietnamese kept the German word "kapseln" in one question ("Nespresso kapseln giá rẻ ở đâu?"); Hindi transliterated "Wasserkocher" in one question; Latvian questions start with a lower case letter. Questions for German product words are sometimes translated word by word (for example Lithuanian "vandens viryklės" for Wasserkocher), so a native check of the languages you use most is worth doing.

## Changes after the test: help popovers

Each field of Input and Advanced got an "i" icon with an English help text (Bootstrap popover, texts in `public/js/help.js`). Browser test: 16 icons are placed, 12 are visible with the default service and 3 more appear with "google ads ideas"; the model picker icon stays hidden while only one Groq model is configured. Every popover opens at its icon, fits into the window at 1280 x 800 and at 375 px width, closes on a second click, on a click elsewhere and on Escape, and no more than one is open at a time. A click on the icon neither toggles "Continuous running" nor focuses a field. No horizontal scroll at 375 px.

## Changes after the test: "brand filter" export column

The Google concept type column (BRAND, OTHER_BRANDS, NON_BRAND, -) is no longer in the table or in Column visibility. It exists only in exports, under the name "brand filter", between the concept columns and the 48-month series. Browser test with real Google Ads data (117 rows, 6 concept requests): the table showed no such column, the Column visibility menu did not list it, and a saved table state that had the column visible was overridden at load. The exported CSV had the header "brand filter" and the values BRAND (6), NON_BRAND (8), OTHER_BRANDS (1) and "-" (5, as a type of a concept group without type); multiple concepts of one row are separated by " | ".

## Changes after the test: brand counter during long runs

The line "Brand filter: N not classified." was refreshed only when the table was redrawn. Above 5000 rows the table is not redrawn while a run is going (to keep the page fast), so the counter froze and jumped only when the run stopped. Reproduced in the browser with the redraw limit lowered to 30 rows: the counter stayed at 15 while the table grew from 15 to 273 rows, then jumped to 273 at the stop. The counter is now refreshed by a timer while the redraw is paused: every 2 seconds, and less often for very large tables (the interval in milliseconds is the row count divided by 50 once that exceeds 2000, so about 10 seconds at 500,000 rows). In the same test it followed the row count with a delay of up to 2 seconds.

## Changes after the test: Pause and Resume

Question: what does "Start doing" do after "Stop doing"? Experiment: it builds a new queue from the text in the input box. Lines with a mark are done; every line without a mark is queried again and also expanded with all prefixes and suffixes (33 unmarked lines became 165 new queries with 3 prefixes and 2 suffixes). The box shows only the first 5000 queue lines, so a longer queue is lost, and the marker line "..." became a keyword. Changes: a Pause/Resume button that keeps the whole queue in memory, the "..." marker is ignored, and a manual stop with a cut queue shows a notice.

Browser test with real Google and Google Ads: while paused nothing moved for 4 seconds (queue, position, table rows unchanged), the label read "paused at query 3 of 11", and Resume continued at the same position without rebuilding the queue (position 3, then 8; the queue kept growing only by new results). Stop while paused and Reset while paused both returned the page to the idle state and hid the button. With Continuous running the pause held in round 2 (position 6 stayed 6 for 3 seconds, sliding line frozen), Resume went on to 10. With "google ads ideas" a pause right after the start sent no request for 4 seconds, and Resume ran to the 300 results limit. A stop with a queue of 42 lines and a box limit of 20 showed the notice; "..." did not enter the queue after a restart.

## Changes after the test: "Non-brand only" checkbox

The brand field and the three-state brand filter were replaced by one checkbox "Non-brand only" next to "Classify brands". Reason: the brand field only mattered for class 2 ("your brand"), which Include already covers without Groq requests. "Classify brands" now asks only whether a keyword mentions any brand (class 0 or 1), with the new prompt `BRAND_PROMPT_ANY`. The page no longer sends `brand`; the API still accepts it. Classes are stored per row for the session and are not asked again.

Browser test with real Groq (93 keywords, one request): 41 class 0, 52 class 1; brand hits such as rossmann, wmf, smeg and bosch were class 1. Ticking the box showed only class 0 rows (44 of 108 in an earlier run), unticking showed all. A second run on the same rows differed in 5 of 93 keywords, all publications (Stiftung Warentest, Oekotest), a known inconsistency. The first version of the prompt, which reused the "(none)" wording of the old prompt, marked all 93 keywords as brands; that is why the dedicated prompt was added. The status line after a run threw an error because it still read the removed brand variable; fixed and re-tested. Mobile width 375 px: no horizontal scroll, help popover fits, a click on the "i" does not toggle the box.

## Changes after the test: two brand columns in the table

The two brand columns are back in the table and in Column visibility. "Concept types (Google)" (BRAND, OTHER_BRANDS, NON_BRAND, "-") shows up together with the other concept columns after "Get concepts". "Brand (Groq)" (0 no brand, 1 brand) shows up after "Classify brands" and is sortable. Both are part of the export when ticked; only the 48-month series stays export-only. The old export-only name "brand filter" is gone.

Browser test with real Groq and Google Ads (93 keywords): after classification the column "Brand (Groq)" appeared by itself (36 class 0, 57 class 1) and the Column visibility menu listed both new columns. After concepts the column "Concept types (Google)" appeared with BRAND, OTHER_BRANDS, NON_BRAND and "-". The export columns were Keyword, Volume, CPC, Competition, the three concept columns, "Brand (Groq)" and the 48-month series (93 rows); with "Non-brand only" ticked the export had 36 rows, all with class 0.

A defect found on the way: the CDN links in `public/index.html` began with `//`, which on `http://localhost` becomes `http://`. The DataTables CDN answers `http://` with a redirect that has no CORS header, so the browser blocked the script and the page stayed empty (no table, no results). All CDN links now start with `https://`.

