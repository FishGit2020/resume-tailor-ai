import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resume Builder — AI-Powered ATS Optimizer',
  description: 'Upload your resumes, build a Fact Bank, and generate tailored resumes for every job.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
