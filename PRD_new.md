# Resume Tailor AI — Complete Technical PRD

> **Audience**: AI systems. This document is written so an AI can reconstruct the entire project from scratch with identical behavior, logic, and UI. Every detail matters — do not omit or approximate.

---

## 1. Project Overview

A single-user, no-auth, localStorage-based web app that:
1. Parses one or more resumes into a structured **Fact Bank**
2. Takes a job description (URL or pasted text) and generates a tailored, ATS-optimized one-page resume
3. Shows a before/after ATS score with a detailed keyword report
4. Allows inline editing of the generated resume
5. Offers an optional **Boost ATS** mode for aggressive keyword insertion
6. Logs every application (company, role, JD text, resume snapshot) in an **Applications** tab
7. Exports ATS-safe PDF via server-side rendering

---

## 2. Tech Stack

| Layer | Choice | Version / Notes |
|-------|--------|-----------------|
| Framework | Next.js App Router | 16.2.0, Turbopack |
| Language | TypeScript | strict mode |
| Styling | Tailwind CSS | v4 |
| AI | OpenAI GPT-4o | `gpt-4o`, JSON mode, temperature 0.1–0.3 |
| PDF generation | `@react-pdf/renderer` | server-side only |
| PDF parsing | `pdf-parse` | locked at 1.1.1 |
| DOCX parsing | `mammoth` | extractRawText |
| HTML scraping | `cheerio` + Node `fetch` | |
| Storage | localStorage | no database |
| Deployment | Vercel (implied) | Next.js serverless functions |

**`next.config.ts`** must declare server-only packages:
```ts
serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer']
```

**`.env.local`** required:
```
OPENAI_API_KEY=sk-...
```

---

## 3. File Structure

```
app/
  globals.css               # Design system: CSS custom properties, base styles
  page.tsx                  # Root page: tab layout, state orchestration
  api/
    parse-resume/route.ts   # POST: parse PDF/DOCX/text → FactBank
    generate-resume/route.ts # POST: full AI pipeline → GeneratedResume
    boost-ats/route.ts      # POST: aggressive ATS optimization pass
    download-pdf/route.ts   # POST: server-side PDF rendering → binary
    scrape-jd/route.ts      # POST: scrape JD from URL

components/
  FactBankEditor.tsx        # Tab 1: upload + edit experience library
  JDInput.tsx               # Tab 2 left panel: JD input + generate trigger
  ResumePreview.tsx         # Tab 2 right panel: inline-editable resume + ATS card
  ResumePDF.tsx             # PDF layout (server-rendered, not shown in browser)
  ApplicationsLog.tsx       # Tab 3: application history

lib/
  types.ts                  # All TypeScript interfaces
  prompts.ts                # All GPT prompt builder functions
  storage.ts                # localStorage: FactBank (with migration)
  applications.ts           # localStorage: Applications log
```

---

## 4. TypeScript Interfaces (`lib/types.ts`)

```ts
export interface Version {
  id: string
  title: string
  bullets: string[]
  sourceFile?: string
}

export interface Experience {
  id: string
  company: string
  location: string
  startDate: string
  endDate: string
  versions: Version[]
}

export interface Education {
  id: string
  school: string
  location: string
  degree: string
  field: string
  startDate: string
  endDate: string
  notes: string[]
}

export interface Contact {
  name: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  website: string
}

export interface FactBank {
  contact: Contact
  experiences: Experience[]
  education: Education[]
  skills: string[]   // flat array, each entry = one category line e.g. "Technical: Python, SQL"
}

export interface GeneratedExperience {
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface JDReport {
  role: string
  company: string
  titleKeywords: string[]
  hardSkills: string[]
  actionKeywords: string[]
  businessContext: string[]
  domainKeywords: string[]
  hardFilters: string[]
  top10: string[]
  alreadyHave: string[]
  needToAdd: string[]
}

export interface GeneratedResume {
  contact: Contact
  education: Education[]
  skills: string[]
  experiences: GeneratedExperience[]
  jdKeywordCoverage: {
    covered: string[]
    missing: string[]
    beforeCovered: string[]
    beforeMissing: string[]
    hardSkillsMissing: string[]
    score: number         // 0-100, weighted, after generation
    beforeScore: number   // 0-100, weighted, before generation
  }
  jdReport: JDReport
}
```

---

## 5. Design System (`app/globals.css`)

### Fonts (Google Fonts, imported at top of globals.css)
- **Syne** (wght 400–800): headings, logo, tab labels, primary buttons
- **DM Mono** (ital, wght 300/400/500): monospace values, ATS scores, dates
- **Instrument Sans** (ital, wght 400/500/600): body text, labels, secondary UI

### CSS Custom Properties (OKLCH color space)
```css
--bg:         oklch(93%  0.010  80)   /* ~#ece8e2 warm light gray page bg */
--surface:    oklch(97%  0.007  80)   /* ~#f6f4f0 card bg */
--surface-2:  oklch(91%  0.013  80)   /* ~#e8e4dc inputs, nested */
--border:     oklch(87%  0.016  80)   /* ~#ddd7ce */
--border-2:   oklch(81%  0.020  80)   /* ~#cdc6bb */
--text:       oklch(15%  0.010  80)   /* ~#1a1810 warm near-black */
--text-muted: oklch(54%  0.018  80)   /* ~#8c7e6e */
--text-dim:   oklch(75%  0.014  80)   /* ~#c4bcb0 */

--ink:        #1a1810                  /* primary action bg (buttons) */
--ink-soft:   oklch(25%  0.010  80)   /* button hover */

--green:        oklch(52%  0.155  145) /* #1e8a52 forest green — ATS success */
--green-bright: oklch(60%  0.17   145)
--green-dim:    oklch(52%  0.155  145 / 0.09)
--green-border: oklch(52%  0.155  145 / 0.25)

--red:        oklch(48%  0.17    25)
--red-dim:    oklch(48%  0.17    25 / 0.08)
--red-border: oklch(48%  0.17    25 / 0.22)
--orange:     oklch(62%  0.16    55)   /* warning/missing keywords */
--blue:       oklch(48%  0.16   265)
```

### Base
- `html, body`: `background: var(--bg)`, `color: var(--text)`, `font-family: 'Instrument Sans'`
- `h1, h2, h3, .font-display`: `font-family: 'Syne'`
- `.font-mono, code, pre`: `font-family: 'DM Mono'`

### Component Classes
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 2px oklch(15% 0.010 80 / 0.06), 0 2px 8px oklch(15% 0.010 80 / 0.04);
}

.input-field {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text);
  font-family: 'DM Mono';
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input-field:focus {
  border-color: var(--green-border);
  box-shadow: 0 0 0 3px var(--green-dim);
}

.btn-primary {
  background: var(--ink);
  color: var(--surface);
  font-family: 'Syne';
  font-weight: 700;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) {
  background: var(--ink-soft);
  transform: translateY(-1px);
}
.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  font-family: 'Instrument Sans';
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
}
.btn-ghost:hover {
  border-color: var(--border-2);
  color: var(--text);
  background: var(--surface-2);
}

.section-label {
  font-family: 'Instrument Sans';
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fadeUp 0.25s ease forwards; }
```

---

## 6. localStorage Schema

### FactBank — key: `resume_builder_factbank`
Stores a `FactBank` object as JSON.

**Migration function** (called on every load): converts old `frames` field → `versions` for backward compatibility:
```ts
function migrate(fb: any): FactBank {
  if (!fb?.experiences) return fb
  fb.experiences = fb.experiences.map((exp: any) => {
    if (exp.frames && !exp.versions) {
      exp.versions = exp.frames
      delete exp.frames
    }
    if (!exp.versions) exp.versions = []
    return exp
  })
  return fb as FactBank
}
```

**Save**: debounced 1000ms with `setTimeout`. Cancels previous timer on each call.

**Export**: triggers browser download of `factbank.json`.

**Import**: reads JSON file, calls `update(fb)` which saves to both state and localStorage.

### Applications — key: `resume_builder_applications`
Stores an array of `Application` objects as JSON.

```ts
export interface Application {
  id: string        // random base36 + Date.now() base36
  date: string      // ISO string
  company: string
  role: string
  resume: GeneratedResume | null
  jdText: string | null
}
```

**sanitize()**: called on every loaded entry, provides null-safe defaults for all fields.

**saveApplication**: prepends new entry (unshift) to array, does not prevent duplicates (caller must manage).

**importApplications**: merges imported entries by id — imported entries that don't exist locally are prepended; existing ones are kept.

---

## 7. API Routes

### POST `/api/parse-resume`

**Input**: `multipart/form-data` with field `files` (one or more File objects)

**File type detection** (magic bytes, not MIME/filename):
- `0x25 0x50 0x44 0x46` (`%PDF`) → PDF → `pdf-parse`
- `0x50 0x4B` (`PK`, ZIP header) → DOCX → `mammoth.extractRawText`
- Anything else → treat as UTF-8 plain text

**Per-file flow**:
1. Convert to Buffer via `file.arrayBuffer()`
2. Detect and extract text
3. Call GPT-4o with `buildParsePrompt(text, filename)`, `response_format: json_object`, `temperature: 0.1`
4. Parse JSON response into `ParsedDoc`
5. On failure: store error, continue with other files

**Merge into FactBank** (`mergeIntofactBank`):
- `contact`: use from first successful parse only
- `experiences`: group by `company.toLowerCase().trim()`. Same company → push new Version into existing Experience. Different company → new Experience entry. Each Version gets a `randomUUID()` id and stores `sourceFile: filename`.
- `education`: deduplicate by `school.toLowerCase().trim()`. First seen wins.
- `skills`: union of all skill strings as a Set (deduplicates exact strings)

**Output**: `{ factBank: FactBank, errors: [{filename, error}] }`

---

### POST `/api/generate-resume`

**Input**: `{ factBank: FactBank, jdText: string }`

**Complete pipeline**:

#### Step A + B (parallel — `Promise.all`):
- **A**: `buildVersionSelectionPrompt(jdText, experiences)` → selects best Version title per experience
- **B**: `buildJDReportPrompt(jdText)` → extracts structured keyword report

Both use `gpt-4o`, `json_object`, `temperature: 0.1`.

#### After A+B:
- Extract `hardSkills`, `businessContext`, `titleKeywords`, `top10` from report
- Build `atsKeywords = [...new Set([...hardSkills, ...businessContext, ...titleKeywords])]`
- Build `versionMap: Map<experienceId, selectedVersionId>` from selections

**Keyword matching algorithm** (`keywordMatches(kw, text)`):
1. Exact substring match (case-insensitive)
2. Stem both kw and text, try substring match
3. Every word in kw must match (exact or stemmed) some word in text

**Stemming** (`stem(word)`): strips suffixes `ing`, `tion`, `ment`, `ed`, `er`, `ly`, `s`, `es`

**BEFORE score calculation**:
- Concatenate `[selectedVersion.title, ...selectedVersion.bullets]` per experience
- `beforeCovered` = atsKeywords that match original text
- `beforeMissing` = atsKeywords that don't match
- `beforeScore` = weighted score (see below)

**Variant keywords**: keywords that match via stemming but NOT exact substring → passed separately to bullet rewrite prompt

**Weighted ATS score formula**:
```
hardSkills: 2 points each
titleKeywords: 1.5 points each
businessContext: 1 point each
score = Math.round(earned / total * 100)
```

**Build numbered bullets per experience** (using selected version only):
```
[1] bullet text
[2] bullet text
...
```

#### Step C + D (parallel — `Promise.all`):
- **C**: `buildBulletRewritePrompt(top10, variantKeywords, missingKeywords, experiencesWithNumberedBullets)` → conservative rewrite, `temperature: 0.2`
- **D**: `buildSkillsPrompt(jdText, factBank.skills)` → reorganize skills 2–3 groups, `temperature: 0.2`

Both use `gpt-4o`, `json_object`.

#### Assemble GeneratedResume:
- For each experience: use `selectedVersion.title`, use rewritten bullets from `bulletMap` (fallback to original if missing), strip trailing periods from bullets
- Calculate AFTER score using `[...titles, ...bullets, ...skills].join(' ').toLowerCase()`

#### One-page constraint (loop, max 15 iterations):
1. Render PDF with `@react-pdf/renderer` → parse with `pdf-parse` → get `numpages`
2. If `pages > 1`: find the lowest-scoring bullet across all experiences (score = hardSkill matches × 2 + businessContext matches)
   - Never remove last bullet from any experience
   - If newest experience has notably higher score than oldest, remove from newest; else remove from oldest
3. Repeat until 1 page or max iterations reached
4. If render fails, assume 1 page (don't crash)

**Output**: `{ resume: GeneratedResume }`

---

### POST `/api/boost-ats`

**Input**: `{ resume: GeneratedResume, jdReport: JDReport }`

**Logic**:
1. Separate `missingKeywords` into `missingBusinessContext` (from businessContext + actionKeywords) and `missingHardSkills` (from hardSkills)
2. Run `buildAggressiveBulletRewritePrompt(top10, missingBusinessContext, missingHardSkills, numberedBullets)` → `temperature: 0.3`
   - Key: `experienceId = "${company}-${title}"` (not UUID — uses display name)
3. After bullet rewrite: check which `missingHardSkills` are STILL missing from bullet text
4. If any hard skills still missing → run `buildSkillsBoostPrompt(currentSkills, stillMissingHardSkills)` to inject into skills section
5. Recalculate weighted score on boosted text
6. Return updated `GeneratedResume` with new bullets, skills, coverage, jdReport

**Output**: `{ resume: GeneratedResume }`

---

### POST `/api/download-pdf`

**Input**: `{ resume: GeneratedResume }`

**Logic**: `renderToBuffer(React.createElement(ResumePDFDocument, { resume }))` → return binary PDF

**Response headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="${name}.pdf"
```

---

### POST `/api/scrape-jd`

**Input**: `{ url: string }`

**Logic**:
1. LinkedIn URL → return 422 with `{ error: "...", isLinkedIn: true }` immediately (no fetch attempt)
2. Fetch with 5-second `AbortController` timeout and Chrome-like User-Agent
3. Parse with `cheerio`, remove `script, style, nav, header, footer, [class*="cookie"], [class*="banner"]`
4. Try selectors in order: `[class*="job-description"]`, `[class*="jobDescription"]`, `[class*="job_description"]`, `[id*="job-description"]`, `[id*="jobDescription"]`, `[class*="description"]`, `[class*="posting-description"]`, `main`, `article`, `body`
5. Use first selector that returns >200 chars
6. Truncate to 8000 chars
7. Timeout → 408, fetch error → 422, too short → 422

**Output**: `{ jdText: string }`

---

## 8. AI Prompts (`lib/prompts.ts`)

### `buildParsePrompt(text, filename)`
Instructs GPT to extract structured resume data as JSON. Rules:
- Extract exact text, do not paraphrase bullets
- Dates as written (e.g. "Jan 2022" or "2020–2023")
- LinkedIn/GitHub: URL or username only
- Skills: array of "Category: skill1, skill2" strings
- Missing fields: empty string

**Output JSON schema**:
```json
{
  "contact": { "name","email","phone","location","linkedin","github","website" },
  "experiences": [{ "company","location","startDate","endDate","title","bullets":[] }],
  "education": [{ "school","location","degree","field","startDate","endDate","notes":[] }],
  "skills": ["Category: skill1, skill2"]
}
```

---

### `buildVersionSelectionPrompt(jdText, experiences)`
Sends experience list with only `id`, `company`, and per-version `{id, title}` (NO bullets). JD text truncated to 3000 chars.

**Selection rule**: pick the Version whose title a recruiter hiring for this JD would find most relevant. Selection based ENTIRELY on title function match — do NOT consider bullet content.

Includes function-family examples in prompt:
- PM JD: "Product Manager" > "Project Manager" > "Data Analyst"
- Data Analyst JD: "Risk Data Analytics" > "Project Manager" > "Product Manager"
- "Cofounder | Product" = product management function

**Output JSON**:
```json
{
  "jdFunction": "...",
  "jdSeniority": "...",
  "selections": [
    { "experienceId": "...", "selectedVersionId": "...", "reason": "one sentence" }
  ]
}
```

---

### `buildJDReportPrompt(jdText)`
JD text truncated to 3000 chars. Instructs to use EXACT phrasing from JD. No generic soft skills.

**Output JSON**:
```json
{
  "role": "job title",
  "company": "company name or empty",
  "titleKeywords": ["max 4"],
  "hardSkills": ["tools, software, languages, platforms, technical methods — max 12"],
  "actionKeywords": ["verb + object phrases from Responsibilities — max 8"],
  "businessContext": ["business scenarios, domain concepts — max 10"],
  "domainKeywords": ["industry/domain words — max 5"],
  "hardFilters": ["explicit requirements like '3+ years', 'SQL required' — max 6"],
  "top10": ["10 most important keywords ranked by importance"]
}
```

---

### `buildBulletRewritePrompt(top10, variantKeywords, missingKeywords, experiencesWithNumberedBullets)`

**Default conservative mode.** Rules (strict order):
1. **RETURN UNCHANGED**: Any bullet not needing a keyword change — copy EXACTLY character-for-character
2. **VARIANT FIX**: Replace variant forms (e.g. "A/B testing" → "A/B test") — change ONLY that word/phrase, nothing else
3. **KEYWORD INSERT**: For MISSING keywords only — insert naturally with absolute minimum edit. If no bullet can naturally accept it, skip
4. **NEVER** fabricate facts, numbers, tools, or any detail not in original
5. **NEVER** end any bullet with a period
6. Return the EXACT SAME NUMBER of bullets per experience — no merging, splitting, or dropping

**Output JSON**:
```json
{
  "experiences": [
    { "experienceId": "...", "bullets": ["bullet 1", "bullet 2"] }
  ]
}
```

---

### `buildAggressiveBulletRewritePrompt(top10, missingBusinessContext, missingHardSkills, experiencesWithNumberedBullets)`

**Boost mode.** More aggressive:
1. RETURN UNCHANGED: bullets not needing changes
2. BUSINESS CONTEXT KEYWORDS: proactively insert into most relevant bullet even if it requires a small rewrite of that phrase. Do NOT fabricate metrics or company-specific facts
3. HARD SKILLS: only insert if bullet already demonstrates use of that skill
4. NEVER fabricate numbers, company names, or achievements
5. NEVER end bullet with period
6. EXACT SAME NUMBER of bullets per experience

---

### `buildSkillsPrompt(jdText, rawSkills)`
JD text truncated to 1500 chars.
- Keep EVERY skill from candidate's list — do NOT omit any skill
- Consolidate into exactly 2–3 groups
- Put JD-relevant skills first within each group
- Format: `"CategoryName: skill1, skill2"`

**Output JSON**: `{ "skills": ["Category: skills..."] }`

---

### `buildSkillsBoostPrompt(currentSkills, missingKeywords)`
- Add each missing keyword to most relevant existing skill category
- If no category fits, add a new line
- Keep EVERY existing skill
- Keep to 2–4 total skill lines
- **If a keyword is a business concept, outcome, or process (not a tool, technology, or methodology), do NOT add it to skills — skip it entirely**

**Output JSON**: `{ "skills": ["Category: skills..."] }`

---

### `buildTrimPrompt(jdText, atsKeywords, experiencesWithBullets)`
Used when resume exceeds one page (this prompt exists in `prompts.ts` but the actual trimming in `generate-resume/route.ts` is done algorithmically without calling AI — the prompt is available but not used in the main flow).

---

## 9. Component: `app/page.tsx`

### State
```ts
tab: 'factbank' | 'generate' | 'applications'
factBank: FactBank | null      // null until loaded from localStorage
resume: GeneratedResume | null
jdText: string                 // the JD text used for current resume
applications: Application[]
saved: boolean                 // whether current resume is saved to applications
resumeKey: number              // incremented on each new generation; passed as key prop to ResumePreview to force remount and reset boosted state
```

### Initialization
`useEffect` on mount: `setFactBank(loadFactBank())`, `setApplications(loadApplications())`

Render null (spinner) while `factBank === null`.

### Key handlers
- `handleFactBankChange(fb)`: update state + save to localStorage
- `handleGenerated(r, jd)`: set resume, set jdText, reset `saved=false`, increment `resumeKey`, switch to 'generate' tab
- `handleDownloaded()`: if `!resume || saved` return early; call `saveApplication(...)` with `resume.jdReport.company`, `resume.jdReport.role`, `resume`, `jdText`; reload applications from localStorage; set `saved=true`

### Header
- `sticky top-0 z-50`, backdrop-blur, border-bottom
- Logo: just text "Resume Tailor AI" in Syne 700 20px, no icon, no version badge
- Tab nav: pill container with `var(--surface-2)` bg and `var(--border)` border
  - Active tab: `var(--ink)` bg, `var(--surface)` text, Syne 700 15px
  - Inactive tab: `var(--text-muted)` text, Syne 15px
  - Fact Bank tab: shows count badge when `experiences.length > 0`
  - Generate tab: shows small green dot when `resume` exists and tab is not active
  - Applications tab: shows count badge when `applications.length > 0`
- Right side: empty spacer `width: 220px` to balance header layout

### Generate tab layout
- Header row with "Generate Resume" title + conditional Save Application button
- "Save Application" button: `height: 36px`, `Instrument Sans 600 13px`
  - Normal: `var(--surface)` bg, `var(--border)` border, `var(--text-muted)` text
  - Saved state: `var(--green-dim)` bg, `var(--green-border)` border, `var(--green)` text, disabled
  - Shows "✓ Saved to Applications" when saved
- Orange warning banner if FactBank is empty
- Grid layout: `gridTemplateColumns: resume ? '380px 1fr' : '480px'`
  - Left: JDInput in `.card`
  - Right: ResumePreview (only when `resume` exists)

---

## 10. Component: `components/JDInput.tsx`

### Props
```ts
factBank: FactBank
onGenerated: (resume: GeneratedResume, jdText: string) => void
```

### State
```ts
mode: 'url' | 'text'
url: string
jdText: string          // paste mode text
loading: 'scraping' | 'generating' | null
error: string
scrapedText: string     // URL mode: editable textarea after fetch
activeStep: number      // 0-3 for progress steps
stepTimers: useRef<ReturnType<typeof setTimeout>[]>([])
```

### URL mode behavior
- Input + "Fetch JD" button
- On success: shows editable `<textarea>` (6 rows, transparent bg, no border, DM Mono 11px) inside green-dim box with **"JD fetched — please verify content carefully"** label (font-bold, green) — user should confirm content is a real JD before generating
- User can directly edit the scraped text before generating
- On error: show error message; if not LinkedIn, auto-switch to text mode

### Text mode
- Full `<textarea>` with `input-field` class, 12 rows

### Generate button
- `btn-primary w-full`, padding 14px 20px, fontSize 15px, fontWeight 700, borderRadius 10px
- Disabled when: `isLoading || !activeText.trim() || !factBank.experiences.length`
- Loading state: spinner + "Generating tailored resume..."
- Normal state: lightning bolt SVG + "Generate Resume"

### Fake progress steps (shown during generation)
4 steps displayed below generate button:
1. "Selecting best title version for each experience..."
2. "Analyzing JD keywords..."
3. "Rewriting bullets with JD keywords..."
4. "Fitting to one page..."

Timer schedule (set at start of generation):
- Step 1 activates at t=0 (immediately, `activeStep` starts at 0)
- Step 2 activates at t=4000ms
- Step 3 activates at t=9000ms
- Step 4 activates at t=16000ms

Visual per step:
- `i < activeStep`: green solid dot, text `var(--text)` — completed
- `i === activeStep`: green pulsing dot (`animate-pulse`), text `var(--text)` — in progress
- `i > activeStep`: gray dot (`var(--border-2)`), text `var(--text-dim)` — pending

All timers cleared in `finally` block; `activeStep` reset to 0 after generation.

---

## 11. Component: `components/ResumePreview.tsx`

### Props
```ts
resume: GeneratedResume
onChange: (r: GeneratedResume) => void
onDownloaded?: () => void
```

### Internal state
```ts
downloading: boolean
hovered: string | null    // id of hovered row for delete button
showReport: boolean       // keyword report panel toggle
boosting: boolean
boosted: boolean          // once true, Boost button becomes "Boosted" pill
```

### Editable component
Ref-based DOM editing pattern (prevents re-render from resetting typed content):
- `contentEditable` div/span
- Sets `innerHTML` on mount via callback ref
- `isEditing` ref prevents overwriting while user is typing
- On `blur`: calls `onChange(innerText.trim())`
- Syncs external value changes when `!isEditing`

### SkillEditable component
Same pattern but renders `<strong>category:</strong>items` HTML for visual bold category display.

### Row component (hover-reveal delete)
Wraps any row with `onMouseEnter/Leave` to show/hide `×` delete button. Delete button turns `#cc2222` on hover.

### ATS Score Card (top of ResumePreview)
Structure:
```
[card with ink top border]
  [main row: padding 20px 24px]
    [score rings — flex-shrink 0]
      ScoreRing(beforePct, var(--text-dim), "Before")
      → arrow SVG
      ScoreRing(afterPct, var(--green), "After")
    [stats — flex: 1]
      +{improvement}% in DM Mono 26px green (if improvement > 0)
      "ATS match improvement" in Instrument Sans 13px green 75% opacity
      Missing hard skills warning in red 13px (if any)
      Other missing keywords in orange 13px (if any)
    [action buttons — flex-shrink 0, align flex-end]
      [button row]
        Recalculate button (if jdReport exists)
        Boost ATS button OR "Boosted" pill (if needToAdd.length > 0 and not yet boosted)
        Download PDF button
      "Click to edit · hover row to delete" — 13px var(--text-muted)
  [keyword report toggle — centered pill, border-top]
    pill button: "View keyword report" / "Hide keyword report" with animated chevron
  [keyword report panel — if showReport]
    3-column grid, 20px 24px padding, border-top
    Columns: Role, Hard Skills (red), Business Context (blue), Title/Function (#7c6fcd), Action Keywords, Domain, Hard Filters (orange)
    Full-width bottom row: Top 10 (green), ✓ Have (green), ✗ Missing (red)
```

**ScoreRing SVG**: 84×84, center 42,42, radius 32, strokeWidth 5. Uses `stroke-dasharray` for fill. Inner text: `{pct}%` in DM Mono 16px 700.

**All 3 buttons** (Recalculate, Boost ATS, Download PDF): identical styling:
- `height: 34, padding: 0 14px, display: flex, alignItems: center, gap: 6`
- `background: var(--surface-2), border: 1px solid var(--border), borderRadius: 8`
- `color: var(--text-muted), fontFamily: Instrument Sans, fontWeight: 600, fontSize: 13`
- Hover: `color: var(--text), borderColor: var(--border-2)`

**Recalculate** (`recalcScore`): pure client-side recalculation using same weighted formula, no API call.

**Boost ATS** (`boostATS`): POST to `/api/boost-ats` with `resume` + `resume.jdReport`. On success: `onChange(data.resume)`, `setBoosted(true)`. Once boosted, shows "Boosted" pill (same dimensions as buttons).

**Download PDF** (`downloadPDF`): POST to `/api/download-pdf`, creates blob URL, triggers `<a>` click download, calls `onDownloaded?.()` on success.

### Resume Preview Area
A `816px` wide, `min-height: 1056px` white div (US Letter dimensions at 96dpi) with:
- `padding: 36px`
- `font-family: Cambria, "Times New Roman", serif`
- `fontSize: 8.5pt, lineHeight: 1.25`
- Red dashed page boundary line at `top: 1008px` (absolute positioned, pointer-events none)

**Section order**: Education → Skills → Work Experience

**Header**:
- Name: centered, 14pt bold
- Contact line: centered, 8pt, `#333`, items separated by ` | `
- LinkedIn/GitHub/Website: rendered as `<a>` links with `color: #1155CC`

**Education section**: `EDUCATION` in 9pt uppercase bold, 2px solid black border-bottom
- School bold + location bold (space-between)
- Degree italic, field bold+italic
- Notes as bullet rows (hover-delete enabled)

**Skills section**: `SKILLS`, each line with `•` dot and `SkillEditable` (category bold, items plain)
- "+ add skill" button below

**Work Experience section**: `WORK EXPERIENCE`
- Company bold + location bold (space-between)
- Title italic + dates (space-between)
- Bullets: `•` dot + `Editable`, hover-delete enabled
- "+ add bullet" button below each experience

---

## 12. Component: `components/ResumePDF.tsx`

Server-side only. Uses `@react-pdf/renderer`.

**Font**: `Times-Roman` (base), `Times-Bold`, `Times-Italic`, `Times-BoldItalic`

**Page**: `LETTER` size, all padding 36pt, `fontSize: 8.5`, `lineHeight: 1.25`

**Section order**: Education → Skills → Work Experience (same as preview)

**Contact line**: centered `flexDirection: row, justifyContent: center, flexWrap: wrap`
- Items: phone (plain), email (Link to mailto), linkedin (Link text "LinkedIn"), github (Link text "GitHub"), website (Link text "Website")
- Separated by ` | ` text nodes
- Link color: `#1155CC`
- URL normalization: prepend `https://` if not already `http`

**Skills**: `parseSkillLine` splits at first `:` — category rendered in `Times-Bold`, items in `Times-Roman`

**Degree row**: degree in `Times-Italic`, field in `Times-BoldItalic`, separated by `, `

**Bullets**: `flexDirection: row`, `•` in 10pt width column, text in `flex: 1, textAlign: justify`

---

## 13. Component: `components/FactBankEditor.tsx`

### Upload zone
Dashed border (`1.5px dashed var(--border-2)`), `surface-2` bg. Click or drag-and-drop.
- On drop: update hover styles via `e.currentTarget.style`, call `handleUpload(e.dataTransfer.files)`
- Loading state: spinner + "Parsing resumes with AI..."
- Accepts: `.pdf,.docx,.txt`, multiple

### Upload → parse → merge
1. POST `multipart/form-data` to `/api/parse-resume`
2. Merge new `FactBank` into existing using `mergeEducation`, `mergeExperiences`, `mergeSkills`
   - `mergeExperiences`: same company → append new Versions; new company → add new Experience
   - `mergeEducation`: same school → keep existing (first seen wins)
   - `mergeSkills`: Set union of skill strings
3. If merge preserves existing contact (only overwrite if name is empty)

### Experience card
- Collapsed: shows `{company}` in Syne 600 15px + `{n} version(s)` label + `▾` chevron
- Expanded: company/location/startDate/endDate fields in 4-col grid + Version tabs + Remove button

### Version tabs
- Active: `var(--green-dim)` bg, `var(--green-border)` border, `var(--green)` text
- Inactive: `var(--surface-2)` bg, `var(--border)` border, `var(--text-muted)` text
- Delete button on tab (only shown if >1 version)
- "+ Version" button with dashed border

### Active version editor
- Title input (`input-field`)
- Bullet textareas (`input-field resize-none`, 2 rows each) with `×` delete button
- "+ Add bullet" text button
- `sourceFile` displayed in DM Mono 11px dim text if present

### Skills section
- Each skill: `•` dot + `input-field` + `×` button
- "+ Add skill group" text button

### Export/Import
- Export: triggers `factbank.json` download
- Import: file input, reads JSON, calls `update(fb)` directly (replaces entire FactBank)

---

## 14. Component: `components/ApplicationsLog.tsx`

### Props
```ts
applications: Application[]
onChange: (apps: Application[]) => void
```

### Empty state
Shows clipboard emoji (40px, 20% opacity) + "No applications yet" + hint text + Import JSON button only.

### Toolbar (when apps exist)
- Left: "{n} application(s) saved" count
- Right: Export JSON + Import JSON buttons

### Import merge logic
- Load imported entries, filter out any with `id` already in current list, prepend new ones
- Persist merged array to localStorage key `resume_builder_applications`

### Application card
Collapsed header (`padding: 16px 20px`, clickable):
- Date: DM Mono 11px dim
- Role: Syne 700 15px + `@ company` in Instrument Sans 13px muted (if company != '—')
- ATS score badge: DM Mono 12px 700 green, `+{improvement}%` if positive
- Right: Remove button (turns red on hover) + `▾` chevron (rotates 180deg when open)

Expanded panel (`background: var(--surface-2), padding: 20px 24px`):
- Contact: name in Syne 700 16px + email/phone/location joined by ` · `
- Skills: each line in DM Mono 12px
- Experiences: company Syne 600 13px + dates DM Mono 11px dim; title italic 12px muted; bullets with `•` dots
- JD text: `<details>` element, shows first 2000 chars, truncated with `...`
- If `app.resume === null`: shows "No resume data saved for this application."
- All fields are null-safe: `e?.company || '—'`, `e?.bullets ?? []`, etc.

---

## 15. Key Algorithms

### Keyword Matching (`keywordMatches`)
Used in 3 places with identical implementation: `generate-resume/route.ts`, `boost-ats/route.ts`, `ResumePreview.tsx` (recalcScore).

```ts
function keywordMatches(kw: string, text: string): boolean {
  const kwLower = kw.toLowerCase()
  if (text.includes(kwLower)) return true                  // exact
  const stemmedKw = kwLower.split(/\s+/).map(stem).join(' ')
  if (text.includes(stemmedKw)) return true               // stemmed phrase
  const kwWords = kwLower.split(/\s+/)
  return kwWords.every(w => {                             // all words match
    const ws = stem(w)
    return text.includes(w) || text.split(/\s+/).some(tw => stem(tw) === ws)
  })
}

function stem(word: string): string {
  return word
    .replace(/ing$/, '').replace(/tion$/, '').replace(/ment$/, '')
    .replace(/ed$/, '').replace(/er$/, '').replace(/ly$/, '')
    .replace(/s$/, '').replace(/es$/, '')
}
```

### Weighted ATS Score
```
hardSkills: 2pts, titleKeywords: 1.5pts, businessContext: 1pt
score = Math.round(earned / total * 100)
```
Total = sum of all weights. Score is 0–100.

### One-page Trimming Loop
- Max 15 iterations
- Per iteration: score each bullet by `hardSkill matches × 2 + businessContext matches`
- Find lowest-scoring bullet per experience (minimum 1 bullet must remain)
- Remove bullet from oldest experience unless newest has notably lower score (delta > 1)
- Re-render PDF to check page count

### ID Generation
- FactBank entries: `Math.random().toString(36).slice(2) + Date.now().toString(36)`
- Application entries: same pattern
- Parse-resume (server): `randomUUID()` from Node `crypto`

---

## 16. Error Handling Patterns

| Scenario | Behavior |
|----------|----------|
| File parse fails | Store error per file, continue parsing others; show errors in red box |
| JD scrape fails | Show error message; if not LinkedIn, auto-switch to text mode |
| LinkedIn URL | 422 with `isLinkedIn: true`; do NOT switch to text mode automatically |
| Scrape timeout (>5s) | 408 response, user-facing message to paste text instead |
| Generate/Boost API error | Show error in red box in JDInput |
| PDF download fails | `alert(String(err))` |
| localStorage parse error | Return empty defaults (EMPTY_FACTBANK or `[]`) |
| One-page render crash | Assume 1 page, don't crash generation |
| Application null fields | `sanitize()` provides fallback values; UI uses `?.` and `?? '—'` throughout |

---

## 17. User Flow (Complete)

```
1. FIRST TIME SETUP
   Open app → Fact Bank tab (default)
   Upload 1+ resume files (PDF/DOCX/TXT)
   AI parses → merges into FactBank → auto-saved to localStorage
   Review + edit: contact, education, skills, experiences
   Each experience has 1+ version (title + bullets from each uploaded resume)
   User can add/delete versions, edit titles/bullets, add experiences manually

2. GENERATE RESUME
   Switch to Generate tab
   Enter JD: paste URL → click "Fetch JD" → editable scraped text appears
     OR: switch to "Paste Text" → paste JD directly
   Click "Generate Resume"
   Progress steps animate green sequentially during generation (~10-20s)
   AI runs in parallel:
     - Selects best version title per experience (based on title function match)
     - Extracts JD keyword report
     Then parallel:
     - Rewrites bullets (conservative: minimal changes, variant fixes, keyword inserts)
     - Reorganizes skills (2-3 groups, JD-relevant first)
   One-page check: trim lowest-scoring bullets if >1 page
   Resume appears in right panel

3. REVIEW + EDIT
   ATS card shows before → after score rings + improvement %
   Missing hard skills in red, other missing in orange
   "View keyword report" pill toggles detailed keyword breakdown
   Click any text in resume preview to edit inline
   Hover any row to reveal × delete button
   Click "Recalculate" to update score after edits (no AI call)
   Click "Boost ATS" for aggressive keyword insertion (AI call)
     → After boost: shows "Boosted" pill, score updates

4. SAVE + DOWNLOAD
   Click "Download PDF" → generates PDF server-side → browser download
     → automatically saves application to Applications log (once only)
   OR click "Save Application" header button to save without downloading
   "✓ Saved to Applications" indicator appears, button grays out

5. APPLICATIONS LOG
   Switch to Applications tab
   Card list: date, role @ company, ATS score badge, +improvement %
   Click card to expand: contact, skills, experiences, JD text (collapsible)
   Remove individual entries
   Export JSON (full backup) / Import JSON (merge by id)
```

---

## 18. Critical Implementation Details

1. **`@react-pdf/renderer` is server-only** — must be in `serverExternalPackages` in `next.config.ts`. Never import in client components.

2. **`pdf-parse` version must be 1.1.1** — other versions have issues in Next.js serverless.

3. **Editable component pattern** — do NOT use controlled React state for contentEditable. Use ref-based DOM pattern with `isEditing` guard to prevent render-based cursor reset.

4. **Boost ATS experience ID** — uses `"${company}-${title}"` composite key, NOT the UUID from GeneratedExperience (which has no id field). This is how the boost API matches bullets back.

5. **Keyword report panel** — uses inline grid (`gridTemplateColumns: '1fr 1fr 1fr'`), not Tailwind classes, because it's inside the ATS card which uses inline styles throughout.

6. **FactBank save debounce** — 1000ms. Uses a module-level `let debounceTimer` variable, not React state, so it persists across renders.

7. **Applications save** — NOT debounced. Writes to localStorage synchronously on every `saveApplication` call.

8. **`import { renderToBuffer } from '@react-pdf/renderer'`** — must use `React.createElement` directly when calling from route.ts, not JSX, due to server component restrictions: `React.createElement(ResumePDFDocument, { resume }) as any`.

9. **Migration**: When loading FactBank from localStorage, always run `migrate()` to handle old `frames` field → `versions`. This is permanent backward compat for users who had data before the rename.

10. **Trim loop candidate selection**: `perExp[perExp.length - 1]` is oldest experience (last in array), `perExp[0]` is newest. Chooses newest if `oldest.score > newest.score + 1`, otherwise oldest. This preferentially keeps newest (most recent) experience bullets intact.

11. **`next.config.ts`**: The `serverExternalPackages` array tells Turbopack/webpack not to bundle these packages but to require them at runtime. Without this, `@react-pdf/renderer` crashes.

12. **Skills format**: Always `"CategoryName: skill1, skill2"` with colon separator. `parseSkillLine` splits at first `:`. Empty category → renders plain. This format is used consistently in FactBank, GeneratedResume, PDF rendering, and Boost.

13. **Contact links**: In both Preview and PDF, LinkedIn/GitHub/Website are rendered as hyperlinks with display text ("LinkedIn", "GitHub", "Website"), not raw URLs. Preview uses `<a>` tags. PDF uses `@react-pdf/renderer`'s `<Link>` component.

14. **Page boundary line**: A red dashed horizontal line at `top: 1008px` inside the preview canvas (absolute positioned). 1008px = 1056px total height - 48px bottom padding. Shows users where the one-page boundary is.
