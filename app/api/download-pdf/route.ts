import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { GeneratedResume } from '@/lib/types'
import { ResumePDFDocument } from '@/components/ResumePDF'
import React from 'react'

export async function POST(req: NextRequest) {
  try {
    const { resume }: { resume: GeneratedResume } = await req.json()
    if (!resume) return NextResponse.json({ error: 'No resume provided' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(ResumePDFDocument, { resume }) as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${resume.contact.name || 'resume'}.pdf"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
