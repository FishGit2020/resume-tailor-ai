'use client'

import { useState, useEffect } from 'react'
import { FactBank, GeneratedResume } from '@/lib/types'
import { loadFactBank, saveFactBank } from '@/lib/storage'
import { Application, loadApplications, saveApplication } from '@/lib/applications'
import FactBankEditor from '@/components/FactBankEditor'
import JDInput from '@/components/JDInput'
import ResumePreview from '@/components/ResumePreview'
import ApplicationsLog from '@/components/ApplicationsLog'

type Tab = 'factbank' | 'generate' | 'applications'

export default function Home() {
  const [tab, setTab] = useState<Tab>('factbank')
  const [factBank, setFactBank] = useState<FactBank | null>(null)
  const [resume, setResume] = useState<GeneratedResume | null>(null)
  const [jdText, setJdText] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [saved, setSaved] = useState(false)
  const [resumeKey, setResumeKey] = useState(0)

  useEffect(() => {
    setFactBank(loadFactBank())
    setApplications(loadApplications())
  }, [])

  function handleFactBankChange(fb: FactBank) {
    setFactBank(fb)
    saveFactBank(fb)
  }

  function handleGenerated(r: GeneratedResume, jd: string) {
    setResume(r)
    setJdText(jd)
    setSaved(false)
    setResumeKey(k => k + 1)
    setTab('generate')
  }

  function handleDownloaded() {
    if (!resume || saved) return
    saveApplication({
      company: resume.jdReport?.company || '—',
      role: resume.jdReport?.role || '—',
      resume,
      jdText: jdText || null,
    })
    setApplications(loadApplications())
    setSaved(true)
  }

  if (!factBank) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
      </div>
    )
  }

  const hasFactBank = factBank.experiences.length > 0

  const tabStyle = (t: Tab) => t === tab
    ? { background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'Syne', fontWeight: 700, fontSize: '15px', boxShadow: '0 1px 3px oklch(15% 0.010 80 / 0.2)' }
    : { color: 'var(--text-muted)', fontFamily: 'Syne', fontSize: '15px' }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top Bar */}
      <header className="border-b sticky top-0 z-50" style={{ borderColor: 'var(--border)', background: 'oklch(93% 0.010 80 / 0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', color: 'var(--text)' }}>Resume Tailor AI</span>
          </div>

          {/* Tab Nav */}
          <nav className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setTab('factbank')}
              className="px-5 py-2 rounded-lg font-medium transition-all"
              style={tabStyle('factbank')}
              onMouseEnter={e => { if (tab !== 'factbank') (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { if (tab !== 'factbank') (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              Fact Bank
              {hasFactBank && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={tab === 'factbank' ? { background: 'rgba(246,244,240,0.2)', color: 'var(--surface)' } : { background: 'var(--border)', color: 'var(--text-muted)' }}>
                  {factBank.experiences.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('generate')}
              className="px-5 py-2 rounded-lg font-medium transition-all"
              style={tabStyle('generate')}
              onMouseEnter={e => { if (tab !== 'generate') (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { if (tab !== 'generate') (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              Generate
              {resume && tab !== 'generate' && (
                <span className="ml-2 w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--green)' }} />
              )}
            </button>
            <button
              onClick={() => setTab('applications')}
              className="px-5 py-2 rounded-lg font-medium transition-all"
              style={tabStyle('applications')}
              onMouseEnter={e => { if (tab !== 'applications') (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { if (tab !== 'applications') (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              Applications
              {applications.length > 0 && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={tab === 'applications' ? { background: 'rgba(246,244,240,0.2)', color: 'var(--surface)' } : { background: 'var(--border)', color: 'var(--text-muted)' }}>
                  {applications.length}
                </span>
              )}
            </button>
          </nav>

          {/* Spacer */}
          <div style={{ width: '220px' }} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">

        {tab === 'factbank' && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h1 style={{ fontFamily: 'Syne', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '8px', color: 'var(--text)' }}>Fact Bank</h1>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Instrument Sans', fontSize: '14px', lineHeight: 1.5 }}>
                Your experience library. Upload resumes to populate it, then edit as needed.
              </p>
            </div>
            <FactBankEditor factBank={factBank} onChange={handleFactBankChange} />
          </div>
        )}

        {tab === 'generate' && (
          <div className="animate-fade-up">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 style={{ fontFamily: 'Syne', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '8px', color: 'var(--text)' }}>Generate Resume</h1>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'Instrument Sans', fontSize: '14px', lineHeight: 1.5 }}>
                  Provide a job description and AI will tailor your resume for maximum ATS match.
                </p>
              </div>
              {resume && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {saved && (
                    <span style={{ fontFamily: 'Instrument Sans', fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                      Saved
                    </span>
                  )}
                  <button
                    onClick={() => { if (!saved) handleDownloaded() }}
                    disabled={saved}
                    style={{
                      height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 7,
                      background: saved ? 'var(--green-dim)' : 'var(--surface)',
                      border: `1px solid ${saved ? 'var(--green-border)' : 'var(--border)'}`,
                      borderRadius: 8, cursor: saved ? 'default' : 'pointer',
                      color: saved ? 'var(--green)' : 'var(--text-muted)',
                      fontFamily: 'Instrument Sans', fontWeight: 600, fontSize: 13,
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!saved) { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-2)'; el.style.color = 'var(--text)' } }}
                    onMouseLeave={e => { if (!saved) { const el = e.currentTarget as HTMLElement; el.style.borderColor = saved ? 'var(--green-border)' : 'var(--border)'; el.style.color = saved ? 'var(--green)' : 'var(--text-muted)' } }}
                  >
                    {saved ? '✓ Saved to Applications' : 'Save Application'}
                  </button>
                </div>
              )}
            </div>

            {!hasFactBank && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'oklch(62% 0.16 55 / 0.08)', border: '1px solid oklch(62% 0.16 55 / 0.22)' }}>
                <p className="text-sm" style={{ color: 'var(--orange)', fontFamily: 'Instrument Sans' }}>
                  ⚠ Your Fact Bank is empty.{' '}
                  <button onClick={() => setTab('factbank')} className="underline underline-offset-2">
                    Upload your resumes first
                  </button>
                  {' '}before generating.
                </p>
              </div>
            )}

            <div className="grid gap-6" style={{ gridTemplateColumns: resume ? '380px 1fr' : '480px' }}>
              <div className="card h-fit">
                <JDInput factBank={factBank} onGenerated={handleGenerated} />
              </div>
              {resume && (
                <div className="animate-fade-up overflow-hidden">
                  <ResumePreview key={resumeKey} resume={resume} onChange={setResume} onDownloaded={handleDownloaded} />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'applications' && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h1 style={{ fontFamily: 'Syne', fontSize: '38px', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '8px', color: 'var(--text)' }}>Applications</h1>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Instrument Sans', fontSize: '14px', lineHeight: 1.5 }}>
                Your application history. Each entry saves the tailored resume you sent.
              </p>
            </div>
            <ApplicationsLog applications={applications} onChange={setApplications} />
          </div>
        )}

      </main>
    </div>
  )
}
