import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { renderToBuffer } from '@react-pdf/renderer'
import pdfParse from 'pdf-parse'
import { FactBank, GeneratedResume, GeneratedExperience, JDReport } from '@/lib/types'
import {
  buildFrameSelectionPrompt,
  buildJDReportPrompt,
  buildBulletRewritePrompt,
  buildSkillsPrompt,
} from '@/lib/prompts'
import React from 'react'
import { ResumePDFDocument } from '@/components/ResumePDF'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function countPDFPages(resume: GeneratedResume): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(ResumePDFDocument, { resume }) as any)
    const parsed = await pdfParse(buffer)
    console.log(`[one-page check] pages: ${parsed.numpages}`)
    return parsed.numpages
  } catch (err) {
    console.error('[one-page check] renderToBuffer/pdfParse failed:', err)
    return 1
  }
}

function stem(word: string): string {
  return word
    .replace(/ing$/, '').replace(/tion$/, '').replace(/ment$/, '')
    .replace(/ed$/, '').replace(/er$/, '').replace(/ly$/, '')
    .replace(/s$/, '').replace(/es$/, '')
}

function keywordMatches(kw: string, text: string): boolean {
  const kwLower = kw.toLowerCase()
  if (text.includes(kwLower)) return true
  const stemmedKw = kwLower.split(/\s+/).map(stem).join(' ')
  if (text.includes(stemmedKw)) return true
  const kwWords = kwLower.split(/\s+/)
  return kwWords.every(w => {
    const ws = stem(w)
    return text.includes(w) || text.split(/\s+/).some(tw => stem(tw) === ws)
  })
}

export async function POST(req: NextRequest) {
  try {
    const { factBank, jdText }: { factBank: FactBank; jdText: string } = await req.json()

    if (!factBank || !jdText) {
      return NextResponse.json({ error: 'Missing factBank or jdText' }, { status: 400 })
    }

    // Step A + B in parallel: Frame selection & JD Report
    const [frameSelectionCompletion, jdReportCompletion] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: buildFrameSelectionPrompt(jdText, factBank.experiences) }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: buildJDReportPrompt(jdText) }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    ])

    const frameSelection = JSON.parse(frameSelectionCompletion.choices[0].message.content || '{}') as {
      jdFunction: string
      jdSeniority: string
      selections: Array<{ experienceId: string; selectedFrameId: string }>
    }

    const rawReport = JSON.parse(jdReportCompletion.choices[0].message.content || '{}') as Omit<JDReport, 'alreadyHave' | 'needToAdd'>

    // Extract categorized keywords from report
    const hardSkills = rawReport.hardSkills || []
    const businessContext = rawReport.businessContext || []
    const titleFunction = rawReport.titleKeywords || []
    const top10 = rawReport.top10 || []
    const atsKeywords = [...new Set([...hardSkills, ...businessContext, ...titleFunction])]

    // Weighted score: hardSkills=2pts, titleFunction=1.5pts, businessContext=1pt
    function calcWeightedScore(text: string): number {
      let earned = 0, total = 0
      hardSkills.forEach(kw => { total += 2; if (keywordMatches(kw, text)) earned += 2 })
      titleFunction.forEach(kw => { total += 1.5; if (keywordMatches(kw, text)) earned += 1.5 })
      businessContext.forEach(kw => { total += 1; if (keywordMatches(kw, text)) earned += 1 })
      return total > 0 ? Math.round(earned / total * 100) : 0
    }

    // Build frame map
    const frameMap = new Map(frameSelection.selections.map(s => [s.experienceId, s.selectedFrameId]))

    // Build numbered bullets for each experience using selected frame
    const experiencesWithNumberedBullets = factBank.experiences.map(exp => {
      const selectedFrameId = frameMap.get(exp.id)
      const selectedFrame = exp.frames.find(f => f.id === selectedFrameId) || exp.frames[0]
      const bullets = selectedFrame.bullets.filter(b => b.trim())
      const numberedBullets = bullets.map((b, i) => `[${i + 1}] ${b}`).join('\n')
      return { experienceId: exp.id, company: exp.company, numberedBullets }
    })

    // Calculate BEFORE score (include titles so "Data Scientist Intern" etc. are matched)
    const originalText = factBank.experiences.map(exp => {
      const selectedFrameId = frameMap.get(exp.id)
      const selectedFrame = exp.frames.find(f => f.id === selectedFrameId) || exp.frames[0]
      return [selectedFrame.title, ...selectedFrame.bullets].join(' ')
    }).join(' ').toLowerCase()

    const beforeCovered = atsKeywords.filter(kw => keywordMatches(kw, originalText))
    const beforeMissing = atsKeywords.filter(kw => !keywordMatches(kw, originalText))
    const beforeScore = calcWeightedScore(originalText)

    // Variant keywords: matches via stemming but not exact
    const variantKeywords = atsKeywords.filter(kw => {
      const kwLower = kw.toLowerCase()
      return !originalText.includes(kwLower) && keywordMatches(kw, originalText)
    })
    const missingKeywords = beforeMissing

    console.log('[keywords] hardSkills:', hardSkills)
    console.log('[keywords] businessContext:', businessContext)
    console.log('[keywords] top10:', top10)
    console.log('[keywords] variantKeywords:', variantKeywords)
    console.log('[keywords] missingKeywords:', missingKeywords)
    console.log('[score] beforeScore:', beforeScore)

    // Step C + D in parallel: Bullet rewrite & Skills
    const [bulletRewriteCompletion, skillsCompletion] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: buildBulletRewritePrompt(top10, variantKeywords, missingKeywords, experiencesWithNumberedBullets) }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: buildSkillsPrompt(jdText, factBank.skills) }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    ])

    const bulletResult = JSON.parse(bulletRewriteCompletion.choices[0].message.content || '{}') as {
      experiences: Array<{ experienceId: string; bullets: string[] }>
    }
    console.log('[bullet rewrite result]', JSON.stringify(bulletResult.experiences?.map(e => ({ id: e.experienceId, count: e.bullets?.length, sample: e.bullets?.[0]?.slice(0, 80) }))))
    const bulletMap = new Map(bulletResult.experiences.map(e => [e.experienceId, e.bullets]))

    const skillsResult = JSON.parse(skillsCompletion.choices[0].message.content || '{}') as { skills: string[] }

    // Assemble generated resume
    const generatedExperiences: GeneratedExperience[] = factBank.experiences.map(exp => {
      const selectedFrameId = frameMap.get(exp.id)
      const selectedFrame = exp.frames.find(f => f.id === selectedFrameId) || exp.frames[0]
      const bullets = bulletMap.get(exp.id) || selectedFrame.bullets
      return {
        company: exp.company,
        title: selectedFrame.title,
        location: exp.location,
        startDate: exp.startDate,
        endDate: exp.endDate,
        bullets: bullets.map(b => b.trimEnd().replace(/\.$/, '')),
      }
    })

    // Calculate AFTER score (include titles + bullets + skills)
    const resumeText = [
      ...generatedExperiences.map(e => e.title),
      ...generatedExperiences.flatMap(e => e.bullets),
      ...(skillsResult.skills || factBank.skills),
    ].join(' ').toLowerCase()

    const covered = atsKeywords.filter(kw => keywordMatches(kw, resumeText))
    const missing = atsKeywords.filter(kw => !keywordMatches(kw, resumeText))
    const afterScore = calcWeightedScore(resumeText)
    const hardSkillsMissing = hardSkills.filter(kw => !keywordMatches(kw, resumeText))

    // Build final JD report with gap analysis
    const jdReport: JDReport = {
      ...rawReport,
      alreadyHave: covered,
      needToAdd: missing,
    }

    let resume: GeneratedResume = {
      contact: factBank.contact,
      education: factBank.education,
      skills: skillsResult.skills || factBank.skills,
      experiences: generatedExperiences,
      jdKeywordCoverage: {
        covered, missing, beforeCovered, beforeMissing,
        hardSkillsMissing, score: afterScore, beforeScore,
      },
      jdReport,
    }

    // One-page constraint: render and trim if needed
    let pageCount = await countPDFPages(resume)
    let iterations = 0
    const maxIterations = 15

    while (pageCount > 1 && iterations < maxIterations) {
      iterations++

      const perExp = resume.experiences
        .map((exp, expIdx) => {
          if (exp.bullets.length <= 1) return null
          let lowestScore = Infinity
          let lowestBulletIdx = -1
          exp.bullets.forEach((bullet, j) => {
            const score = hardSkills.filter(kw => bullet.toLowerCase().includes(kw.toLowerCase())).length * 2
              + businessContext.filter(kw => bullet.toLowerCase().includes(kw.toLowerCase())).length
            if (score < lowestScore) { lowestScore = score; lowestBulletIdx = j }
          })
          if (lowestBulletIdx === -1) return null
          return { expIdx, bulletIdx: lowestBulletIdx, score: lowestScore }
        })
        .filter(Boolean) as Array<{ expIdx: number; bulletIdx: number; score: number }>

      if (perExp.length === 0) break

      const oldest = perExp[perExp.length - 1]
      const newest = perExp[0]
      const toRemove = (perExp.length > 1 && oldest.score > newest.score + 1) ? newest : oldest

      resume = {
        ...resume,
        experiences: resume.experiences.map((exp, i) =>
          i === toRemove.expIdx
            ? { ...exp, bullets: exp.bullets.filter((_, j) => j !== toRemove.bulletIdx) }
            : exp
        ),
      }

      pageCount = await countPDFPages(resume)
    }

    return NextResponse.json({ resume })
  } catch (err) {
    console.error('Generate resume error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
