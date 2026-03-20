import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    // Check for LinkedIn
    if (url.includes('linkedin.com')) {
      return NextResponse.json({
        error: 'LinkedIn job pages require login and cannot be scraped automatically. Please copy and paste the job description text instead.',
        isLinkedIn: true,
      }, { status: 422 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    let html: string
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (err: unknown) {
      clearTimeout(timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timed out (5s). Please paste the job description text instead.' }, { status: 408 })
      }
      return NextResponse.json({ error: `Failed to fetch URL: ${String(err)}. Please paste the job description text instead.` }, { status: 422 })
    }

    const $ = cheerio.load(html)

    // Remove noise
    $('script, style, nav, header, footer, [class*="cookie"], [class*="banner"], [id*="cookie"]').remove()

    // Try common job posting containers first
    const selectors = [
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[class*="job_description"]',
      '[id*="job-description"]',
      '[id*="jobDescription"]',
      '[class*="description"]',
      '[class*="posting-description"]',
      'main',
      'article',
      'body',
    ]

    let text = ''
    for (const sel of selectors) {
      const el = $(sel).first()
      if (el.length) {
        text = el.text().replace(/\s+/g, ' ').trim()
        if (text.length > 200) break
      }
    }

    if (!text || text.length < 100) {
      return NextResponse.json({ error: 'Could not extract job description from this page. Please paste the text instead.' }, { status: 422 })
    }

    return NextResponse.json({ jdText: text.slice(0, 8000) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
