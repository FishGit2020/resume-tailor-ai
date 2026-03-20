'use client'

import { useState, useEffect } from 'react'
import { FactBank, GeneratedResume } from '@/lib/types'
import { loadFactBank, saveFactBank } from '@/lib/storage'
import FactBankEditor from '@/components/FactBankEditor'
import JDInput from '@/components/JDInput'
import ResumePreview from '@/components/ResumePreview'

type Tab = 'factbank' | 'generate'

export default function Home() {
  const [tab, setTab] = useState<Tab>('factbank')
  const [factBank, setFactBank] = useState<FactBank | null>(null)
  const [resume, setResume] = useState<GeneratedResume | null>(null)

  useEffect(() => {
    setFactBank(loadFactBank())
  }, [])

  function handleFactBankChange(fb: FactBank) {
    setFactBank(fb)
    saveFactBank(fb)
  }

  function handleGenerated(r: GeneratedResume) {
    setResume(r)
    setTab('generate')
  }

  if (!factBank) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasFactBank = factBank.experiences.length > 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top Bar */}
      <header className="border-b sticky top-0 z-50 backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'rgba(12,12,15,0.85)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--amber)' }}>
              <span className="text-stone-900 font-bold text-sm" style={{ fontFamily: 'Syne' }}>R</span>
            </div>
            <span className="font-bold text-base" style={{ fontFamily: 'Syne' }}>ResumeAI</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}>
              v1
            </span>
          </div>

          {/* Tab Nav */}
          <nav className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
            <button
              onClick={() => setTab('factbank')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'factbank'
                  ? 'text-stone-900 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              style={tab === 'factbank' ? { background: 'var(--amber)', fontFamily: 'Syne' } : { fontFamily: 'Syne' }}
            >
              Fact Bank
              {hasFactBank && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={tab === 'factbank' ? { background: 'rgba(0,0,0,0.15)' } : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {factBank.experiences.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('generate')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'generate'
                  ? 'text-stone-900 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              style={tab === 'generate' ? { background: 'var(--amber)', fontFamily: 'Syne' } : { fontFamily: 'Syne' }}
            >
              Generate
              {resume && tab !== 'generate' && (
                <span className="ml-2 w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ade80' }} />
              )}
            </button>
          </nav>

          {/* Status */}
          <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {hasFactBank
              ? <span style={{ color: '#4ade80' }}>● {factBank.experiences.length} exp · {factBank.education.length} edu</span>
              : <span>No data yet — upload a resume</span>
            }
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        {tab === 'factbank' && (
          <div className="animate-fade-up">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>Fact Bank</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                Your experience library. Upload resumes to populate it, then edit as needed.
              </p>
            </div>
            <FactBankEditor factBank={factBank} onChange={handleFactBankChange} />
          </div>
        )}

        {tab === 'generate' && (
          <div className="animate-fade-up">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>Generate Resume</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                Provide a job description and AI will tailor your resume for maximum ATS match.
              </p>
            </div>

            {!hasFactBank && (
              <div className="mb-6 p-4 rounded-xl border" style={{ background: 'rgba(240,160,32,0.05)', borderColor: 'var(--amber-border)' }}>
                <p className="text-sm" style={{ color: 'var(--amber)' }}>
                  ⚠ Your Fact Bank is empty.{' '}
                  <button onClick={() => setTab('factbank')} className="underline underline-offset-2">
                    Upload your resumes first
                  </button>
                  {' '}before generating.
                </p>
              </div>
            )}

            <div className="grid gap-6" style={{ gridTemplateColumns: resume ? '380px 1fr' : '480px' }}>
              {/* Left: JD Input */}
              <div className="card h-fit">
                <JDInput factBank={factBank} onGenerated={handleGenerated} />
              </div>

              {/* Right: Preview */}
              {resume && (
                <div className="animate-fade-up overflow-hidden">
                  <ResumePreview
                    resume={resume}
                    onChange={setResume}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
