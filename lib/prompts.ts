import { Experience } from './types'

export function buildParsePrompt(text: string, filename: string): string {
  return `You are parsing a resume document. Extract all information and return valid JSON.

RESUME TEXT (from file: ${filename}):
${text}

Return JSON with this exact structure:
{
  "contact": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "experiences": [
    {
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "title": "",
      "bullets": ["..."]
    }
  ],
  "education": [
    {
      "school": "",
      "location": "",
      "degree": "",
      "field": "",
      "startDate": "",
      "endDate": "",
      "notes": []
    }
  ],
  "skills": ["Category: skill1, skill2"]
}

Rules:
- Extract exact text from the resume, do not paraphrase bullets
- For dates use format like "Jan 2022" or "2020–2023" as written
- LinkedIn: extract profile URL or username only
- GitHub: extract profile URL or username only
- skills: array of strings, each string is one category line like "Technical: Python, SQL, React"
- If a field is not found, use empty string`
}

export function buildFrameSelectionPrompt(
  jdText: string,
  experiences: Experience[]
): string {
  const expSummary = experiences.map(exp => ({
    id: exp.id,
    company: exp.company,
    frames: exp.frames.map(f => ({
      id: f.id,
      title: f.title,
    }))
  }))

  return `You are a senior recruiter selecting the best job title frame for each work experience to maximize a candidate's fit for a specific role.

JOB DESCRIPTION:
${jdText.slice(0, 3000)}

CANDIDATE'S EXPERIENCES WITH AVAILABLE FRAMES:
${JSON.stringify(expSummary, null, 2)}

Your task — select the single best Frame title for each experience.

Rule: Pick the Frame whose title a recruiter hiring for this JD would find most relevant.
- Selection is based ENTIRELY on title function match — do NOT consider bullet content
- Choose the title that is closest in job function to the JD's primary role
- "Closest" means same functional family, not necessarily exact wording:
  • For a Product Manager JD: "Product Manager" > "Project Manager" > "Data Analyst" > "Risk Analytics"
  • For a Data Analyst JD: "Risk Data Analytics" > "Project Manager" > "Product Manager"
  • "Cofounder | Product" = product management function
- If no title closely matches the JD function, pick the one with the most transferable skills for that function

Return JSON:
{
  "jdFunction": "...",
  "jdSeniority": "...",
  "selections": [
    { "experienceId": "...", "selectedFrameId": "...", "reason": "one sentence why" }
  ]
}`
}

export function buildJDReportPrompt(jdText: string): string {
  return `You are an expert ATS analyst. Analyze this job description and extract structured keyword data.

JOB DESCRIPTION:
${jdText.slice(0, 3000)}

Extract keywords into these categories. Use EXACT phrasing from the JD. Do NOT include generic soft skills (communication, collaboration, teamwork — these have no ATS value).

Return JSON:
{
  "role": "job title from JD",
  "company": "company name if mentioned, else empty string",
  "titleKeywords": ["exact job title", "close variants", "function words — max 4"],
  "hardSkills": ["tools, software, languages, platforms, technical methods, A/B testing — max 12"],
  "actionKeywords": ["verb + object phrases from Responsibilities section, e.g. 'drive cross-functional execution' — max 8"],
  "businessContext": ["business scenarios and domain concepts, e.g. 'roadmap', 'stakeholder management', 'product launch' — max 10"],
  "domainKeywords": ["industry/domain words, e.g. 'SaaS', 'B2B', 'fintech' — max 5"],
  "hardFilters": ["explicit requirements, e.g. '3+ years', 'Bachelor degree', 'SQL required' — max 6"],
  "top10": ["the 10 most important keywords a recruiter would search for, ranked by importance"]
}`
}

export function buildBulletRewritePrompt(
  top10Keywords: string[],
  variantKeywords: string[],
  missingKeywords: string[],
  experiencesWithNumberedBullets: Array<{
    experienceId: string
    company: string
    numberedBullets: string
  }>
): string {
  const expBlocks = experiencesWithNumberedBullets.map(e =>
    `EXPERIENCE: ${e.company} (id: ${e.experienceId})\nBULLETS:\n${e.numberedBullets}`
  ).join('\n\n')

  return `You are optimizing resume bullet points for ATS (Applicant Tracking System) compatibility using MINIMAL changes.

GOAL: Maximize keyword match with the job description while preserving the original bullet quality as much as possible.

TOP 10 JD KEYWORDS (most important for this role):
${top10Keywords.join(', ')}

RULES (follow in strict order):
1. RETURN UNCHANGED: Any bullet that does not need a keyword change — copy it EXACTLY character-for-character. Do not rephrase, reorder, or improve it.
2. VARIANT FIX: If a bullet contains a variant form of a keyword (e.g. "A/B testing" when JD says "A/B test", or "managing" when JD says "management") — replace ONLY that word/phrase with the JD's exact phrasing. Change absolutely nothing else in that bullet.
3. KEYWORD INSERT: For MISSING keywords only — find the single most relevant bullet and insert the keyword naturally with the absolute minimum edit. If no bullet can naturally accept the keyword, skip it. Do NOT force awkward insertions.
4. NEVER fabricate facts, numbers, company names, tools, or any detail not in the original bullet.
5. NEVER end any bullet with a period.
6. Return the EXACT SAME NUMBER of bullets for each experience — do not merge, split, or drop any bullet.

VARIANT KEYWORDS — find the variant form in the bullets and replace with this exact JD phrasing:
${variantKeywords.length > 0 ? variantKeywords.join(', ') : '(none)'}

MISSING KEYWORDS — not present at all, insert naturally where possible:
${missingKeywords.length > 0 ? missingKeywords.join(', ') : '(none)'}

${expBlocks}

Return JSON (no markdown, no code blocks, just raw JSON):
{
  "experiences": [
    {
      "experienceId": "...",
      "bullets": ["bullet 1", "bullet 2", ...]
    }
  ]
}`
}

export function buildAggressiveBulletRewritePrompt(
  top10Keywords: string[],
  missingBusinessContext: string[],
  missingHardSkills: string[],
  experiencesWithNumberedBullets: Array<{
    experienceId: string
    company: string
    numberedBullets: string
  }>
): string {
  const expBlocks = experiencesWithNumberedBullets.map(e =>
    `EXPERIENCE: ${e.company} (id: ${e.experienceId})\nBULLETS:\n${e.numberedBullets}`
  ).join('\n\n')

  return `You are optimizing resume bullet points for maximum ATS keyword coverage.

TOP 10 JD KEYWORDS:
${top10Keywords.join(', ')}

RULES:
1. RETURN UNCHANGED: Any bullet that does not need changes — copy EXACTLY.
2. BUSINESS CONTEXT KEYWORDS — these are general PM/business concepts (e.g. NPS, feature development, friction points, consumer experiences). For each one, find the most relevant bullet and work it in naturally. Be proactive — if a bullet is about the same topic, add the keyword even if it requires a small rewrite of that phrase. Do NOT fabricate metrics or company-specific facts.
3. HARD SKILLS KEYWORDS — only insert if the bullet already demonstrates use of that skill. Do not add a tool the candidate clearly didn't use.
4. NEVER fabricate numbers, company names, or specific achievements not in the original.
5. NEVER end any bullet with a period.
6. Return the EXACT SAME NUMBER of bullets per experience.

MISSING BUSINESS CONTEXT KEYWORDS (insert proactively):
${missingBusinessContext.length > 0 ? missingBusinessContext.join(', ') : '(none)'}

MISSING HARD SKILLS (insert only where evidenced):
${missingHardSkills.length > 0 ? missingHardSkills.join(', ') : '(none)'}

${expBlocks}

Return JSON (no markdown, no code blocks, just raw JSON):
{
  "experiences": [
    {
      "experienceId": "...",
      "bullets": ["bullet 1", "bullet 2", ...]
    }
  ]
}`
}

export function buildSkillsBoostPrompt(
  currentSkills: string[],
  missingKeywords: string[]
): string {
  return `You are adding missing ATS keywords into an existing resume skills section.

CURRENT SKILLS:
${currentSkills.join('\n')}

MISSING KEYWORDS TO ADD:
${missingKeywords.join(', ')}

RULES:
- Add each missing keyword to the most relevant existing skill category
- If no existing category fits, add a new category line
- Keep EVERY existing skill — do not remove or modify existing content
- Format: "CategoryName: skill1, skill2, skill3"
- Keep to 2-4 total skill lines

Return JSON (no markdown):
{
  "skills": ["CategoryName: skill1, skill2", ...]
}`
}

export function buildSkillsPrompt(
  jdText: string,
  rawSkills: string[]
): string {
  return `You are organizing skills for a resume based on a job description.

JOB DESCRIPTION (excerpt):
${jdText.slice(0, 1500)}

CANDIDATE'S RAW SKILLS:
${rawSkills.join('\n')}

Task:
- Keep EVERY skill from the candidate's list — do NOT omit any skill
- Consolidate into exactly 2–3 groups (merge related categories together to save space)
- Put JD-relevant skills first within each group
- Format each group as: "CategoryName: skill1, skill2, skill3"

Return JSON (no markdown):
{
  "skills": [
    "CategoryName: skill1, skill2",
    "CategoryName: skill3, skill4"
  ]
}`
}

export function buildTrimPrompt(
  jdText: string,
  atsKeywords: string[],
  experiencesWithBullets: Array<{
    experienceId: string
    company: string
    bullets: string[]
  }>
): string {
  const expBlocks = experiencesWithBullets.map(e =>
    `${e.company} (id: ${e.experienceId}):\n${e.bullets.map((b, i) => `[${i}] ${b}`).join('\n')}`
  ).join('\n\n')

  return `The resume is too long and needs to be trimmed to fit one page.

JD ATS KEYWORDS: ${atsKeywords.join(', ')}

CURRENT BULLETS:
${expBlocks}

Remove the LEAST relevant bullets first (lowest keyword overlap with JD).
- Remove one bullet at a time from the least relevant experience
- Never remove all bullets from an experience
- Return the trimmed result

Return JSON:
{
  "experiences": [
    { "experienceId": "...", "bullets": [...remaining bullets...] }
  ]
}`
}
