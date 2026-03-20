'use client'

import { useState, useRef, useCallback } from 'react'
import { FactBank, Experience, Education, Frame } from '@/lib/types'
import { saveFactBank, exportFactBank, importFactBank } from '@/lib/storage'

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface Props {
  factBank: FactBank
  onChange: (fb: FactBank) => void
}

export default function FactBankEditor({ factBank, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [expandedExp, setExpandedExp] = useState<string | null>(null)
  const [activeFrame, setActiveFrame] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = useCallback((fb: FactBank) => {
    onChange(fb)
    saveFactBank(fb)
  }, [onChange])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadErrors([])
    try {
      const form = new FormData()
      for (const f of Array.from(files)) form.append('files', f)
      const res = await fetch('/api/parse-resume', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Merge new data into existing factBank
      const newFB = data.factBank as FactBank
      const merged: FactBank = {
        contact: factBank.contact.name ? factBank.contact : newFB.contact,
        education: mergeEducation(factBank.education, newFB.education),
        experiences: mergeExperiences(factBank.experiences, newFB.experiences),
        skills: mergeSkills(factBank.skills, newFB.skills),
      }
      update(merged)
      if (data.errors?.length) {
        setUploadErrors(data.errors.map((e: { filename: string; error: string }) => `${e.filename}: ${e.error}`))
      }
    } catch (err) {
      setUploadErrors([String(err)])
    } finally {
      setUploading(false)
    }
  }

  function mergeEducation(existing: Education[], incoming: Education[]): Education[] {
    const map = new Map(existing.map(e => [e.school.toLowerCase(), e]))
    for (const edu of incoming) {
      if (!map.has(edu.school.toLowerCase())) map.set(edu.school.toLowerCase(), edu)
    }
    return Array.from(map.values())
  }

  function mergeExperiences(existing: Experience[], incoming: Experience[]): Experience[] {
    const map = new Map(existing.map(e => [e.company.toLowerCase(), e]))
    for (const exp of incoming) {
      const key = exp.company.toLowerCase()
      if (map.has(key)) {
        const ex = map.get(key)!
        map.set(key, { ...ex, frames: [...ex.frames, ...exp.frames] })
      } else {
        map.set(key, exp)
      }
    }
    return Array.from(map.values())
  }

  function mergeSkills(existing: string[], incoming: string[]): string[] {
    const set = new Set([...existing, ...incoming])
    return Array.from(set)
  }

  function updateContact(field: keyof FactBank['contact'], value: string) {
    update({ ...factBank, contact: { ...factBank.contact, [field]: value } })
  }

  function updateExp(id: string, patch: Partial<Experience>) {
    update({ ...factBank, experiences: factBank.experiences.map(e => e.id === id ? { ...e, ...patch } : e) })
  }

  function deleteExp(id: string) {
    update({ ...factBank, experiences: factBank.experiences.filter(e => e.id !== id) })
  }

  function addExp() {
    const id = newId()
    const frameId = newId()
    const newExp: Experience = {
      id,
      company: 'New Company',
      location: '',
      startDate: '',
      endDate: '',
      frames: [{ id: frameId, title: 'Title', bullets: [''], sourceFile: undefined }],
    }
    update({ ...factBank, experiences: [...factBank.experiences, newExp] })
    setExpandedExp(id)
    setActiveFrame(prev => ({ ...prev, [id]: frameId }))
  }

  function addFrame(expId: string) {
    const frameId = newId()
    update({
      ...factBank,
      experiences: factBank.experiences.map(e =>
        e.id === expId
          ? { ...e, frames: [...e.frames, { id: frameId, title: 'New Title', bullets: [''], sourceFile: undefined }] }
          : e
      ),
    })
    setActiveFrame(prev => ({ ...prev, [expId]: frameId }))
  }

  function updateFrame(expId: string, frameId: string, patch: Partial<Frame>) {
    update({
      ...factBank,
      experiences: factBank.experiences.map(e =>
        e.id === expId
          ? { ...e, frames: e.frames.map(f => f.id === frameId ? { ...f, ...patch } : f) }
          : e
      ),
    })
  }

  function deleteFrame(expId: string, frameId: string) {
    update({
      ...factBank,
      experiences: factBank.experiences.map(e =>
        e.id === expId ? { ...e, frames: e.frames.filter(f => f.id !== frameId) } : e
      ),
    })
  }

  function updateBullet(expId: string, frameId: string, idx: number, value: string) {
    const exp = factBank.experiences.find(e => e.id === expId)!
    const frame = exp.frames.find(f => f.id === frameId)!
    const newBullets = frame.bullets.map((b, i) => i === idx ? value : b)
    updateFrame(expId, frameId, { bullets: newBullets })
  }

  function addBullet(expId: string, frameId: string) {
    const exp = factBank.experiences.find(e => e.id === expId)!
    const frame = exp.frames.find(f => f.id === frameId)!
    updateFrame(expId, frameId, { bullets: [...frame.bullets, ''] })
  }

  function deleteBullet(expId: string, frameId: string, idx: number) {
    const exp = factBank.experiences.find(e => e.id === expId)!
    const frame = exp.frames.find(f => f.id === frameId)!
    updateFrame(expId, frameId, { bullets: frame.bullets.filter((_, i) => i !== idx) })
  }

  function updateSkill(idx: number, value: string) {
    const newSkills = factBank.skills.map((s, i) => i === idx ? value : s)
    update({ ...factBank, skills: newSkills })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const fb = await importFactBank(file)
      update(fb)
    } catch (err) {
      setUploadErrors([String(err)])
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        className="border-2 border-dashed border-amber-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/60 transition-colors bg-amber-500/5"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500/60') }}
        onDragLeave={e => e.currentTarget.classList.remove('border-amber-500/60')}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={e => handleUpload(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-amber-400 font-mono text-sm">Parsing resumes with AI...</span>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-2">⊕</div>
            <p className="text-stone-300 font-medium">Drop resume files here or click to upload</p>
            <p className="text-stone-500 text-sm mt-1 font-mono">PDF · DOCX · TXT — multiple files supported</p>
          </div>
        )}
      </div>

      {uploadErrors.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3">
          {uploadErrors.map((e, i) => (
            <p key={i} className="text-red-400 text-sm font-mono">{e}</p>
          ))}
        </div>
      )}

      {/* Export/Import */}
      <div className="flex gap-2">
        <button onClick={() => exportFactBank(factBank)} className="btn-ghost text-xs">Export JSON</button>
        <label className="btn-ghost text-xs cursor-pointer">
          Import JSON
          <input type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
      </div>

      {/* Contact */}
      <section>
        <h3 className="section-label">Contact</h3>
        <div className="card grid grid-cols-2 gap-3">
          {(['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website'] as const).map(field => (
            <div key={field}>
              <label className="text-stone-500 text-xs font-mono uppercase tracking-wider block mb-1">{field}</label>
              <input
                className="input-field w-full"
                value={factBank.contact[field] || ''}
                onChange={e => updateContact(field, e.target.value)}
                placeholder={field}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Education */}
      <section>
        <h3 className="section-label">Education</h3>
        {factBank.education.map(edu => (
          <div key={edu.id} className="card mb-3">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => update({ ...factBank, education: factBank.education.filter(e => e.id !== edu.id) })}
                className="text-stone-600 hover:text-red-400 transition-colors text-sm"
              >Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['school', 'location', 'degree', 'field', 'startDate', 'endDate'] as const).map(f => (
                <div key={f}>
                  <label className="text-stone-500 text-xs font-mono uppercase tracking-wider block mb-1">{f}</label>
                  <input
                    className="input-field w-full"
                    value={(edu[f] as string) || ''}
                    onChange={e => {
                      update({
                        ...factBank,
                        education: factBank.education.map(ed =>
                          ed.id === edu.id ? { ...ed, [f]: e.target.value } : ed
                        ),
                      })
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Skills */}
      <section>
        <h3 className="section-label">Skills</h3>
        <div className="card space-y-2">
          {factBank.skills.map((skill, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-amber-500 font-mono text-sm">•</span>
              <input
                className="input-field flex-1"
                value={skill}
                onChange={e => updateSkill(i, e.target.value)}
                placeholder="Category: skill1, skill2, skill3"
              />
              <button
                onClick={() => update({ ...factBank, skills: factBank.skills.filter((_, j) => j !== i) })}
                className="text-stone-600 hover:text-red-400 transition-colors text-lg leading-none"
              >×</button>
            </div>
          ))}
          <button
            onClick={() => update({ ...factBank, skills: [...factBank.skills, ''] })}
            className="text-amber-500 hover:text-amber-400 text-sm font-mono transition-colors"
          >+ Add skill group</button>
        </div>
      </section>

      {/* Experiences */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-label mb-0">Work Experience</h3>
          <button onClick={addExp} className="btn-ghost text-xs">+ Add Experience</button>
        </div>
        <div className="space-y-3">
          {factBank.experiences.map(exp => {
            const isOpen = expandedExp === exp.id
            const currentFrameId = activeFrame[exp.id] || exp.frames[0]?.id
            const currentFrame = exp.frames.find(f => f.id === currentFrameId) || exp.frames[0]

            return (
              <div key={exp.id} className="card">
                {/* Experience Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedExp(isOpen ? null : exp.id)}
                >
                  <div>
                    <span className="font-semibold text-stone-100">{exp.company || 'Unnamed Company'}</span>
                    <span className="text-stone-500 text-sm ml-2 font-mono">{exp.frames.length} frame{exp.frames.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); deleteExp(exp.id) }}
                      className="text-stone-600 hover:text-red-400 transition-colors text-sm"
                    >Remove</button>
                    <span className={`text-stone-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-4">
                    {/* Company meta fields */}
                    <div className="grid grid-cols-4 gap-2">
                      {(['company', 'location', 'startDate', 'endDate'] as const).map(f => (
                        <div key={f}>
                          <label className="text-stone-500 text-xs font-mono uppercase tracking-wider block mb-1">{f}</label>
                          <input
                            className="input-field w-full"
                            value={exp[f] || ''}
                            onChange={e => updateExp(exp.id, { [f]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Frame Tabs */}
                    <div>
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {exp.frames.map(frame => (
                          <div
                            key={frame.id}
                            role="tab"
                            onClick={() => setActiveFrame(prev => ({ ...prev, [exp.id]: frame.id }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all ${
                              currentFrameId === frame.id
                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                                : 'bg-stone-800 border border-stone-700 text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            <span className="font-mono text-xs truncate max-w-32">{frame.title || 'Untitled'}</span>
                            {exp.frames.length > 1 && (
                              <button
                                onClick={e => { e.stopPropagation(); deleteFrame(exp.id, frame.id) }}
                                className="text-stone-600 hover:text-red-400 ml-1 leading-none"
                              >×</button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addFrame(exp.id)}
                          className="px-3 py-1.5 rounded-lg text-xs text-amber-500 hover:text-amber-400 border border-dashed border-amber-500/30 hover:border-amber-500/60 transition-all font-mono"
                        >+ Frame</button>
                      </div>

                      {/* Active Frame Editor */}
                      {currentFrame && (
                        <div className="bg-stone-900/50 rounded-lg p-4 border border-stone-700/50">
                          <div className="mb-3">
                            <label className="text-stone-500 text-xs font-mono uppercase tracking-wider block mb-1">Title</label>
                            <input
                              className="input-field w-full"
                              value={currentFrame.title}
                              onChange={e => updateFrame(exp.id, currentFrame.id, { title: e.target.value })}
                              placeholder="Job Title"
                            />
                          </div>
                          <div>
                            <label className="text-stone-500 text-xs font-mono uppercase tracking-wider block mb-2">Bullets</label>
                            <div className="space-y-2">
                              {currentFrame.bullets.map((bullet, j) => (
                                <div key={j} className="flex gap-2 items-start">
                                  <span className="text-amber-500 mt-2 font-mono">•</span>
                                  <textarea
                                    className="input-field flex-1 resize-none"
                                    rows={2}
                                    value={bullet}
                                    onChange={e => updateBullet(exp.id, currentFrame.id, j, e.target.value)}
                                    placeholder="Describe your achievement..."
                                  />
                                  <button
                                    onClick={() => deleteBullet(exp.id, currentFrame.id, j)}
                                    className="text-stone-600 hover:text-red-400 transition-colors mt-2 text-lg leading-none"
                                  >×</button>
                                </div>
                              ))}
                              <button
                                onClick={() => addBullet(exp.id, currentFrame.id)}
                                className="text-amber-500 hover:text-amber-400 text-sm font-mono transition-colors"
                              >+ Add bullet</button>
                            </div>
                          </div>
                          {currentFrame.sourceFile && (
                            <p className="text-stone-600 text-xs font-mono mt-3">Source: {currentFrame.sourceFile}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
