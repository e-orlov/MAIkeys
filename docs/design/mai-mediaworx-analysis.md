# Design analysis: mai.mediaworx.com

Source: the live page https://mai.mediaworx.com/ (checked on 20 November 2026), its HTML, its stylesheet `assets/styles-D9eQ1Tn8.css` (118 KB, Tailwind v4) and its computed styles in a desktop viewport of 1440 px. The page is a single-page app built with Vite and React. Compared against the official MAI Group design system (`mai-group-design`, playbook of February 2026).

The design was applied to the tool on 20 November 2026 (`public/css/mai-theme.css`, `public/index.html`).

## 1. Design principles

1. One dark world. The whole page lives on a deep green background. There is no light theme and no section with a white background. Sections are separated by hairlines (1 px, 40 % opacity), not by color changes.
2. One accent. Lime is the only loud color. It marks the single thing that matters in a block: the primary button, the key words of a headline, a number, a link, a label. Everything else is cream and muted green-gray.
3. Flat surfaces, no shadows. Depth comes from a slightly lighter card color and a thin border. The only blur is the sticky header.
4. Soft, large radii and pills. Cards are 16 to 24 px round, every button and badge is a full pill.
5. Few sizes, strong headlines. Display headlines are large (48 to 60 px), tight and bold. Body text is calm: 14 to 18 px in a muted color. Small uppercase labels (eyebrows) introduce every section.
6. Generous space. Sections have 48 to 96 px of vertical padding, grids use 24 px gaps, cards 32 px padding.
7. Quiet motion. Hover changes only a border tint, a background tint, an opacity or a 4 px arrow shift, all in 150 ms. No bounce, no parallax in the content.

How this differs from the official MAI Group design system (important for the discussion): the official system is light-first (white and warm off-white pages with Forest and Indigo as accent surfaces), uses DM Sans and Albert Sans, 24 px cards, soft warm shadows, and the Strichpunkte motif. The mediaworx page is the dark variant, uses Space Grotesk and Inter, flat cards without shadows, and shows no Strichpunkte motif in the content. The two share the green family, the lime accent, pills, generous rounding and the calm tone. See section 9.

## 2. Colors

All values come from `:root` in the stylesheet.

| Role | Token | Value |
|---|---|---|
| Page background | `--background`, `--brand-dark` | `#14372E` |
| Cards, popovers | `--card`, `--popover` | `#184036` |
| Header navigation tint | `--nav` | `#173D33` |
| Secondary and muted surfaces | `--secondary`, `--muted` | `#1C4A3E` |
| Text | `--foreground`, `--brand-cream` | `#F6F2E3` |
| Secondary text | `--muted-foreground` | `#A8B29E` |
| Accent, primary button, links | `--primary`, `--brand-lime` | `#BAFF3F` |
| Text on lime | `--primary-foreground` | `#11302A` |
| Hairlines | `--border` | `#345349` |
| Input borders | `--input` | `#3D5F54` |
| Error | `--destructive` | `#E62B34` |
| Success | `--success` | `#45BA50` |
| Info | `--info` | `#348FF9` |
| Indigo (declared, not seen in the content) | `--brand-indigo` | `#3E55C8` |

Usage of transparency: the header is the background at 80 %, hairlines are `--border` at 40 % (sections, header) or 30 % (card borders), hover borders are lime at 40 to 60 %, hover washes are white at 6 %.

Contrast, computed (WCAG, 4.5 for normal text):

| Pair | Ratio |
|---|---|
| Cream on page | 11.6 |
| Lime on page | 10.8 |
| Muted gray on page | 5.9 |
| Muted gray on card | 5.2 |
| Dark green on lime (button) | 11.8 |
| Success green on card | 4.6 |
| Info blue on card | 3.5 (too low for small text) |
| Error red on card | 2.6 (too low for text) |
| Border on page | 1.5 (decoration only) |

Consequence for a tool with many messages: error and info colors cannot be used as text colors on the dark card. The tool uses a tinted card, a colored border and cream text, with lighter tints (`#FF8A90`, `#7DB5FB`, `#7AD884`) only for the title of the notice. Those three tints are my addition, they are not in the page's palette.

## 3. Typography

| Role | Family | Size / line height | Weight | Tracking | Color |
|---|---|---|---|---|---|
| H1 | Space Grotesk | 60 / 64.8 px (36 px on phones in the tool) | 700 | -1.5 px (-0.025em) | cream, key words lime |
| H2 | Space Grotesk | 48 / 48 px | 700 | -1.2 px | cream |
| H3 (card title) | Space Grotesk | 24 / 32 px | 700 | -0.48 px | cream, lime on card hover |
| Lead paragraph | Inter | 18 / 28 px | 400 | normal | muted gray |
| Card text | Inter | 14 / 22.75 px (relaxed) | 400 | normal | muted gray |
| Navigation | Inter | 14 px | 400 | normal | cream at 80 %, 100 % on hover |
| Button | Inter | 16 px (14 px small) | 600 | normal | dark green on lime, cream on ghost |
| Eyebrow | Inter | 12 px | 400 | 0.1em, uppercase | lime |
| Stat value | Space Grotesk | 36 to 48 px | 700 | normal | lime |
| Stat label | Inter | 14 px | 400 | normal | muted gray |

Fonts are self-hosted as WOFF2 with `font-display: swap`: Inter 400, 500, 600, 700 and Space Grotesk 500, 600, 700, in the Latin, Latin-ext, Cyrillic, Greek and Vietnamese subsets. Body default is 16 px with 24 px line height. The official design system names DM Sans and Albert Sans instead.

## 4. Layout and grid

- Container: `max-w-7xl` (1280 px) centered, side padding 24 px. The hero text block is limited to `max-w-5xl` (1024 px), lead paragraphs to about 672 px.
- Breakpoints (Tailwind v4): 40 rem (640 px), 48 rem (768 px), 64 rem (1024 px). Mobile first.
- Grids: plain CSS grid with 24 px gaps.
  - stat row: 2 columns, 4 from 768 px, gap 32 px;
  - service cards: 1, 2 from 768 px, 3 from 1024 px;
  - reference cards: 1, 3 from 768 px;
  - client logos: 2, 3 from 640 px, 5 from 1024 px (with a marquee animation for the strip);
  - testimonials: a horizontal scroll-snap carousel (85 % wide on phones, 60 % tablet, one third on desktop);
  - feature block: text card next to a photo, two columns from 1024 px;
  - contact block: one large card, two columns from 768 px;
  - footer: 1, 2 from 768 px, 5 from 1024 px.
- Vertical rhythm: sections use 48, 64, 80 or 96 px of padding (`py-12` to `py-24`). Hero: 48 px top, 64 px bottom on desktop. The footer has a 128 px top margin.
- Header: sticky, 80 px high, container-width, logo left, links and a lime pill button right. On phones the links collapse into a menu icon.

## 5. UI elements

Header
- Sticky, `backdrop-blur-md`, background color at 80 %, 1 px bottom border at 40 %.
- Logo as a white SVG (about 32 px high) with an outlined pill badge ("30 JAHRE": lime text, lime border at 50 %, tiny uppercase).
- Links: 14 px, cream at 80 %, dropdown chevrons on "Leistungen" and "Insights".

Buttons
- Primary: full pill, lime background, dark green text, 16 px / 600, padding 16 x 28 px (height 57 px). Hover: opacity 90 %. Small variant in the header: 8 x 20 px, 14 px.
- Ghost: full pill, transparent, 1 px `--border`, cream text. Hover: card color background.
- No shadows, no focus ring other than the browser default (the tool adds a lime 2 px ring for accessibility).

Eyebrow label
- 12 px, uppercase, 0.1em tracking, lime. Sits 24 px above a hero headline and 12 px above section headlines.

Cards
- Surface `#184036`, 1 px border (`--border` at 30 %), radius 16 px (small cards) or 24 px (large cards, images), padding 32 px (24 px for compact cards).
- Clickable cards: hover lowers the card background to 70 % and tints the border lime at 40 %. The title turns lime and the "Mehr erfahren →" arrow moves 4 px to the right.
- Card content pattern: title (H3), text (14 px, muted), a lime link line.

Stat blocks
- Centered. A large Space Grotesk value in lime, a muted 14 px label below.

Reference cards
- Tiny uppercase client name in muted gray, headline, then one big lime figure ("+1000 %") with a small caption and a "Case lesen →" link.

Highlighted card
- Border lime at 30 %, background lime at 5 %, hover border at 60 %.

Images
- Rounded 24 px, large photos next to text cards. The page uses real team photos.

Footer
- Top border at 40 %, five link columns on desktop, small muted text.

Cookie banner (HubSpot)
- A dark card with two full-width pill buttons: lime "Alle akzeptieren" and an outlined "Alle ablehnen".

Forms
- The contact section is a large card. No form fields appeared in the static content, so the input style in the tool is derived from the tokens (`--input` border, 12 px radius) and is my interpretation.

## 6. Motion

- Default transition: 150 ms with `cubic-bezier(.4, 0, .2, 1)` on color, background, border, opacity, transform.
- Used effects: border tint on card hover, arrow `translate-x-1`, `hover:opacity-90` on the lime button, `hover:scale-105` on a few elements, a marquee for the logo strip, accordion open and close, an entrance fade (`enter` and `exit` keyframes).
- `prefers-reduced-motion` is respected in the stylesheet.

## 7. Tone

The page speaks German and uses the formal "Sie" ("Sprechen Sie mit uns"). Headlines are short statements ("Wir bringen Wachstum."). Copy uses `:innen` for gender neutral forms and gives numbers instead of adjectives (30 years, 75+ specialists, +1000 %). The official MAI Group system asks for the informal "Du" and active calls to action. The tool keeps its English texts and does not decide between the two.

## 8. How the pattern is applied to the tool

| Tool element | Treatment |
|---|---|
| Page title and intro | Eyebrow, H1 with a lime phrase, muted lead, three pills (Do Keywords!, Advanced, Reset). |
| Input box and actions | One large card (24 px) with an eyebrow, the textarea on a darker field, ghost pills for the data actions, a lime pill for Classify brands. |
| Do Keywords! / Stop doing | Lime pill. While running it turns into a red pill, and a 3 px lime progress line appears under the header. |
| Advanced | A second large card with the same field style. It opens as a second column on wide screens. |
| Brand filter row | A single row inside the input card, separated by a hairline. |
| Notice box | A tinted card under the filter row: red (action needed), yellow-green (automatic retry, partial results), blue (information), green (done). Cream text, colored border, a dot in the title. The three-part structure (what happened, how long, what to do) stays. |
| Status lines | Small muted text. |
| Results table | One large card with a toolbar (ghost pills, search pill), uppercase muted column headers with lime sort arrows, hairline cell borders, a hover wash. A wide table scrolls horizontally inside the card. |
| Column visibility and Export menus | Popovers on the card color with a 1 px border and a dark shadow. |
| Footer | The name and one line of text, hairline on top. |

## 9. Decisions and open points

Decided on 20 November 2026 (they are the basis of the theme):

1. Type: as on the page (Space Grotesk and Inter).
2. Theme: dark only.
3. Green and lime: as on the page (`#14372E`, `#BAFF3F`).
4. No MAI logo and no Strichpunkte motif.
5. Interface language: English.
6. Wide table: horizontal scroll inside the card.
7. Input fields: the style derived from the tokens is accepted.
8. Table: full cell borders (hairlines on every side of a cell, stronger line under the header), applied.

The list below is the original discussion list. Points 1 to 6 are settled by the decisions above.

1. Which type pair: the page's own Space Grotesk and Inter, or the official DM Sans and Albert Sans. The tool follows the page. Both are geometric sans serifs with similar proportions, so switching later means changing two variables.
2. Dark only, or also a light variant after the official system (white and warm off-white). The tool is used for long sessions with big tables, so a light table could be easier to read.
3. Which green. The page uses `#14372E`, the official system uses Forest `#00392F` and Lime `#C5F966`. Close, but not equal, and the lime of the page (`#BAFF3F`) is more yellow-green.
4. Whether to add the official Strichpunkte motif and the MAI logo. The tool uses neither: the tool is not an MAI product, and the logo would suggest an official MAI application.
5. German or English interface texts, "Sie" or "Du".
6. Table density. The table uses 14 px rows with 14 px vertical padding and scrolls horizontally instead of collapsing columns.
7. Error and info colors as text fail the contrast rule on dark cards (2.6 and 3.5). The tool works around this with tinted surfaces and cream text.

## 10. Method and limits

- I read the HTML and the CSS through the browser (computed styles of the header, buttons, eyebrow, cards, stat blocks, headings, grids; the full stylesheet for variables, fonts, breakpoints and keyframes) and looked at the page at 1440 px width on several scroll positions.
- I declined the non-essential cookies in the consent banner.
- I did not look at subpages, the dropdown menus, the contact form fields and the dark/light logic of other templates. Components not seen on the home page (form inputs, tables) are my interpretation from the tokens.
- The mediaworx logo and its photos are not reused in the tool.
