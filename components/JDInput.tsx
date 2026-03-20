'use client'

import { useState } from 'react'
import { FactBank, GeneratedResume } from '@/lib/types'

interface Props {
  factBank: FactBank
  onGenerated: (resume: GeneratedResume) => void
}

type InputMode = 'url' | 'text'

export default function JDInput({ factBank, onGenerated }: Props) {
  const [mode, setMode] = useState<InputMode>('url')
  const [url, setUrl] = useState('')
  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState<'scraping' | 'generating' | null>(null)
  const [error, setError] = useState('')
  const [scrapedText, setScrapedText] = useState('')

  async function scrapeURL() {
    if (!url.trim()) return
    setLoading('scraping')
    setError('')
    try {
      const res = await fetch('/api/scrape-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        if (!data.isLinkedIn) setMode('text')
        return
      }
      setScrapedText(data.jdText)
    } finally {
      setLoading(null)
    }
  }

  async function generate() {
    const text = mode === 'url' ? scrapedText : jdText
    if (!text.trim()) {
      setError('Please provide a job description first')
      return
    }
    if (!factBank.experiences.length) {
      setError('Your Fact Bank is empty. Please upload at least one resume first.')
      return
    }

    setLoading('generating')
    setError('')
    try {
      const res = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factBank, jdText: text }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      onGenerated(data.resume)
    } finally {
      setLoading(null)
    }
  }

  const isLoading = loading !== null
  const activeText = mode === 'url' ? scrapedText : jdText

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-100 mb-1">Job Description</h2>
        <p className="text-stone-500 text-sm font-mono">Paste a job posting URL or the full JD text</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-stone-700 w-fit">
        <button
          onClick={() => setMode('url')}
          className={`px-4 py-2 text-sm font-mono transition-colors ${mode === 'url' ? 'bg-amber-500 text-stone-900 font-semibold' : 'bg-stone-800 text-stone-400 hover:text-stone-200'}`}
        >URL</button>
        <button
          onClick={() => setMode('text')}
          className={`px-4 py-2 text-sm font-mono transition-colors ${mode === 'text' ? 'bg-amber-500 text-stone-900 font-semibold' : 'bg-stone-800 text-stone-400 hover:text-stone-200'}`}
        >Paste Text</button>
      </div>

      {mode === 'url' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isLoading && scrapeURL()}
              placeholder="https://boards.greenhouse.io/company/jobs/123..."
              disabled={isLoading}
            />
            <button
              onClick={scrapeURL}
              disabled={isLoading || !url.trim()}
              className="btn-primary whitespace-nowrap"
            >
              {loading === 'scraping' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-stone-900/50 border-t-stone-900 rounded-full animate-spin" />
                  Fetching...
                </span>
              ) : 'Fetch JD'}
            </button>
          </div>
          <p className="text-stone-600 text-xs font-mono">
            Works with: Greenhouse, Lever, company career pages · LinkedIn requires manual paste
          </p>
          {scrapedText && (
            <div className="bg-stone-900/50 border border-stone-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-emerald-400 text-xs font-mono">JD fetched successfully</span>
              </div>
              <p className="text-stone-400 text-xs font-mono line-clamp-4">{scrapedText.slice(0, 400)}...</p>
            </div>
          )}
        </div>
      ) : (
        <textarea
          className="input-field w-full resize-none font-mono text-xs"
          rows={12}
          value={jdText}
          onChange={e => setJdText(e.target.value)}
          placeholder="Paste the full job description here..."
          disabled={isLoading}
        />
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={generate}
        disabled={isLoading || !activeText.trim() || !factBank.experiences.length}
        className="btn-primary w-full py-3 text-base font-semibold flex items-center justify-center gap-3"
      >
        {loading === 'generating' ? (
          <>
            <span className="w-5 h-5 border-2 border-stone-900/50 border-t-stone-900 rounded-full animate-spin" />
            <span>Generating tailored resume...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Resume
          </>
        )}
      </button>

      {loading === 'generating' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Step 1: Selecting best title frames for each experience...
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
            <span className="w-2 h-2 bg-stone-600 rounded-full" />
            Step 2: Rewriting bullets with JD keywords...
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
            <span className="w-2 h-2 bg-stone-600 rounded-full" />
            Step 3: Fitting to one page...
          </div>
        </div>
      )}
    </div>
  )
}
