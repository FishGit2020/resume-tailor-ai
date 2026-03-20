import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { buildParsePrompt } from '@/lib/prompts'
import { Experience, Education, FactBank } from '@/lib/types'
import { randomUUID } from 'crypto'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function detectAndExtractText(buffer: Buffer, filename: string): Promise<string> {
  const header = buffer.slice(0, 4).toString('binary')
  const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
  const isDOCX = buffer[0] === 0x50 && buffer[1] === 0x4B

  if (isPDF) {
    const result = await pdfParse(buffer)
    return result.text
  } else if (isDOCX) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else {
    return buffer.toString('utf-8')
  }
}

interface ParsedDoc {
  contact: FactBank['contact']
  experiences: Array<{ company: string; location: string; startDate: string; endDate: string; title: string; bullets: string[] }>
  education: Array<{ school: string; location: string; degree: string; field: string; startDate: string; endDate: string; notes: string[] }>
  skills: string[]
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const results: { filename: string; parsed: ParsedDoc | null; error?: string }[] = []

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const text = await detectAndExtractText(buffer, file.name)

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: buildParsePrompt(text, file.name) }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        })

        const parsed = JSON.parse(completion.choices[0].message.content || '{}') as ParsedDoc
        results.push({ filename: file.name, parsed })
      } catch (err) {
        results.push({ filename: file.name, parsed: null, error: String(err) })
      }
    }

    // Merge all parsed docs into a single FactBank
    const merged = mergeIntofactBank(results)
    return NextResponse.json({ factBank: merged, errors: results.filter(r => r.error) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function mergeIntofactBank(
  results: { filename: string; parsed: ParsedDoc | null; error?: string }[]
): FactBank {
  const factBank: FactBank = {
    contact: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '' },
    experiences: [],
    education: [],
    skills: [],
  }

  const successResults = results.filter(r => r.parsed)

  // Use contact from first successful parse
  if (successResults[0]?.parsed) {
    factBank.contact = successResults[0].parsed.contact
  }

  // Merge experiences: group by company name (case-insensitive)
  const experienceMap = new Map<string, Experience>()

  for (const result of successResults) {
    if (!result.parsed) continue
    for (const exp of result.parsed.experiences) {
      const key = exp.company.toLowerCase().trim()
      if (!experienceMap.has(key)) {
        experienceMap.set(key, {
          id: randomUUID(),
          company: exp.company,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          frames: [],
        })
      }
      const existing = experienceMap.get(key)!
      existing.frames.push({
        id: randomUUID(),
        title: exp.title,
        bullets: exp.bullets,
        sourceFile: result.filename,
      })
    }
  }
  factBank.experiences = Array.from(experienceMap.values())

  // Merge education: deduplicate by school name
  const educationMap = new Map<string, Education>()
  for (const result of successResults) {
    if (!result.parsed) continue
    for (const edu of result.parsed.education) {
      const key = edu.school.toLowerCase().trim()
      if (!educationMap.has(key)) {
        educationMap.set(key, { id: randomUUID(), ...edu })
      }
    }
  }
  factBank.education = Array.from(educationMap.values())

  // Merge skills: collect all unique skill lines
  const skillSet = new Set<string>()
  for (const result of successResults) {
    if (!result.parsed) continue
    for (const s of result.parsed.skills) {
      skillSet.add(s)
    }
  }
  factBank.skills = Array.from(skillSet)

  return factBank
}
