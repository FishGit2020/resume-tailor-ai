export interface Frame {
  id: string
  title: string
  bullets: string[]
  sourceFile?: string
}

export interface Experience {
  id: string
  company: string
  location: string
  startDate: string
  endDate: string
  frames: Frame[]
}

export interface Education {
  id: string
  school: string
  location: string
  degree: string
  field: string
  startDate: string
  endDate: string
  notes: string[]
}

export interface Contact {
  name: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  website: string
}

export interface FactBank {
  contact: Contact
  experiences: Experience[]
  education: Education[]
  skills: string[]
}

export interface GeneratedExperience {
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface JDReport {
  role: string
  company: string
  titleKeywords: string[]
  hardSkills: string[]
  actionKeywords: string[]
  businessContext: string[]
  domainKeywords: string[]
  hardFilters: string[]
  top10: string[]
  alreadyHave: string[]
  needToAdd: string[]
}

export interface GeneratedResume {
  contact: Contact
  education: Education[]
  skills: string[]
  experiences: GeneratedExperience[]
  jdKeywordCoverage: {
    covered: string[]
    missing: string[]
    beforeCovered: string[]
    beforeMissing: string[]
    hardSkillsMissing: string[]
    score: number
    beforeScore: number
  }
  jdReport: JDReport
}
