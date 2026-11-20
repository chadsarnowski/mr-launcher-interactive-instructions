# Mr. Launcher 2.0 Kayak Launch Dock — Native HTML Installation Manual

A responsive, accessible native HTML version of the **NEW 9.16.26 Mr. Launcher Kayak Dock Directions** PowerPoint for American Muscle Docks & Fabrication, in five languages, with the Docky installation assistant, built on the same template as the Mr. Lifter 2.0 manual.

Source of truth: `NEW Mr. Launcher Kayak Dock Directions 9.16.26.pptx`, in the parent `Mr Launcher Kayak` folder. Every instruction, warning, measurement, quantity, part number, caption and photograph comes from that file. Nothing was added, removed or reworded.

## Open it

Double-click `index.html`. No server, no build step, no install.

To publish on Netlify, drop the whole folder in (`netlify.toml` is already set up: it serves the site from the root and blocks `/tools` from the web).

## Page numbering

The site has 10 sections. Section anchors (`#page-1` to `#page-10`) are website IDs. The number shown in each page footer and in the Contents drawer is the **printed manual page number from the PowerPoint**, so what an installer reads always matches the PDF.

| Anchor | Printed page | Section |
|---|---|---|
| page-1 | (cover) | Cover |
| page-2 | 2 | Start Here |
| page-3 | 3 | What's Inside — kit contents and bolt bags |
| page-4 | 4 | Four Step Installation, tools needed, good to know |
| page-5 | 5 | Step One — attach the aluminum pipe supports |
| page-6 | 6 | Step Two — attach the sq. tube stabilizers |
| page-7 | 7 | Step Three — install the aluminum grab-bar |
| page-8 | 8 | Step Four — mount the Kandy Kane pipe receivers & brackets |
| page-9 | 9 | Gallery and dimension drawings |
| page-10 | (back cover) | Questions Before Install? |

The PowerPoint leaves the cover and the back cover unnumbered, so those two footers carry no number here either.

## What the reader gets

- Sticky header with the AMD logo, Menu (contents drawer), text size, dark mode, language picker and a PDF button
- Text size: **A** (18px base) and **A++** (22px base); the choice is remembered per browser
- Light and dark mode; the choice is remembered per browser
- Five languages: English, Español, 中文, Tagalog, Tiếng Việt. Switching keeps the page you are on
- PDF button opens the manual PDF in a new tab, where the browser's own controls print or download it
- Contents drawer from the header Menu and from the **Pages** button in the bottom bar, from every page
- Previous / Next in the floating bottom bar, plus a reading progress bar in the header
- Every instruction photo and diagram enlarges to a full-screen viewer with a 100% zoom toggle and drag-to-pan, so the dimension callouts stay readable on a phone
- Tool and "good to know" checkboxes tick off as you work and are remembered per browser
- Works on desktop, tablet and phone; no horizontal scrolling at any width or text size
- **Docky**, the AI installation assistant, in the bottom right corner (see below)

## File structure

```text
/
├── index.html                 English manual (the only page edited by hand)
├── index-es.html, index-zh.html, index-tl.html, index-vi.html   generated, do not edit
├── styles.css                 shared AMD manual template plus a kayak-specific section at the end
├── script.js                  navigation, contents drawer, theme, text size, language, image zoom
├── dockly-assistant.js        Docky chat panel (browser)
├── dockly-knowledge.js        Docky offline answers and page map (browser, no secrets)
├── dockly-config.js           public Docky settings (no secrets, ever)
├── netlify.toml               functions, security headers; blocks /tools, /netlify and /.env from the web
├── netlify/functions/
│   ├── docky-chat.mjs         AI relay to Google Gemini (holds the key server-side)
│   ├── docky-speak.mjs        voice relay to ElevenLabs (holds the key server-side)
│   ├── docky-status.mjs       tells the page which services are configured
│   └── lib/                   request guards and the Docky system prompt
├── .env.example               list of environment variables for Netlify
├── favicon.ico
├── assets/manuals/            the manual PDF (linked from the PDF button)
├── tools/
│   ├── build_translations.py  builds the four language pages from index.html
│   ├── i18n_units.py          translation extraction and splicing
│   ├── i18n_validate.py       checks a language catalog (tags, numbers, leftovers)
│   └── i18n/es.json, zh.json, tl.json, vi.json   translation catalogs
└── images/                    logos, QR codes, and every photo and diagram from the PowerPoint
```

## Editing the manual

`index.html` is the only page to edit by hand. After changing it:

1. `python3 tools/build_translations.py --check` — lists English text with no translation
2. add the new strings to `tools/i18n/<lang>.json` (keys must match the English exactly)
3. `python3 tools/i18n_validate.py <lang>` — checks tags, numbers and leftover English
4. `python3 tools/build_translations.py` — writes the four language pages

The build refuses to write a page while any translation is missing, so the language pages can never fall behind the English one.

## Images

Every photo, diagram and logo in `images/` was extracted from the PowerPoint at full resolution and resized for the web; nothing was redrawn. The AMD wordmark, the light/dark header logos and the QR code are the same files used in the approved Mr. Lifter 2.0 manual, so branding matches across both.

## Translation notes

47 interface strings (header, drawer, bottom nav, image viewer) are reused verbatim from the approved Mr. Lifter 2.0 catalogs so both manuals read identically. The 104 kayak-specific strings were translated for this manual.

Measurements, part numbers, quantities, phone numbers and URLs are never translated. `tools/i18n_validate.py` enforces that: it fails if a translation changes the digits or the HTML tags of a string.

## Docky and API keys

API keys are never in browser files. The page calls `/api/docky-chat` and `/api/docky-speak`; those Netlify Functions read the keys from Netlify environment variables and call Google and ElevenLabs.

Without keys, Docky still works in Built-in Expert Mode using verified offline answers from `dockly-knowledge.js` (English only). That is also what runs when you open `index.html` straight from disk, since there is no server to call. With `GEMINI_API_KEY` set, Docky answers live, inspects photos and short videos, and replies in the reader's language.

Docky only knows this manual. `netlify/functions/lib/docky-system-prompt.mjs` holds every fact from the 9.16.26 PowerPoint and instructs Docky to refuse anything the manual does not cover and give the AMD phone number instead. The manual states no weight capacity, no dock framing or joist sizes, no permit requirements and no maintenance schedule for this product, so Docky says so rather than guessing.

Protections on the relays: same-origin check, per-visitor rate limit, request size and file type limits, and a fixed system prompt, so the relay cannot be used as a general AI endpoint. Also set spending limits in the Google AI Studio and ElevenLabs dashboards.

### Setting the keys in Netlify

1. Log in at app.netlify.com and open this site.
2. Click **Site configuration**, then **Environment variables**.
3. Click **Add a variable**. Key: `GEMINI_API_KEY`. Value: your Gemini key. Save.
4. Repeat for `ELEVENLABS_API_KEY` if you want Docky to speak answers out loud.
5. Redeploy the site.
