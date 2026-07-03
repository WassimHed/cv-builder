// src/pdf/templates/cv.template.ts
import { Cv, SectionType } from '../../cv/schemas/cv.schema';
import { PersonalInfoContentDto } from '../../cv/dto/section-content/personal-info-content.dto';
import { ExperienceContentDto } from '../../cv/dto/section-content/experience-content.dto';
import { EducationContentDto } from '../../cv/dto/section-content/education-content.dto';
import { SkillsContentDto } from '../../cv/dto/section-content/skills-content.dto';
import { ProjectsContentDto } from '../../cv/dto/section-content/projects-content.dto';
import { CertificationsContentDto } from '../../cv/dto/section-content/certifications-content.dto';
import { LanguagesContentDto } from '../../cv/dto/section-content/languages-content.dto';

const BASE_STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 16pt 0 6pt; border-bottom: 1px solid #000; padding-bottom: 2pt; }
  p, li { line-height: 1.4; margin: 2pt 0; }
  ul { margin: 4pt 0; padding-left: 16pt; }
`;

const SECTION_HEADINGS: Record<SectionType, string> = {
  [SectionType.PERSONAL_INFO]: '',
  [SectionType.EXPERIENCE]: 'Experience',
  [SectionType.EDUCATION]: 'Education',
  [SectionType.SKILLS]: 'Skills',
  [SectionType.PROJECTS]: 'Projects',
  [SectionType.CERTIFICATIONS]: 'Certifications',
  [SectionType.LANGUAGES]: 'Languages',
};

function renderEntry(type: SectionType, content: unknown): string {
  switch (type) {
    case SectionType.PERSONAL_INFO: {
      const c = content as PersonalInfoContentDto;
      return `<h1>${c.fullName}</h1><p>${[c.email, c.phone, c.location].filter(Boolean).join(' | ')}</p>`;
    }
    case SectionType.EXPERIENCE: {
      const c = content as ExperienceContentDto;
      return `<p><strong>${c.role}</strong>, ${c.company} (${c.startDate}–${c.endDate ?? 'Present'})</p><ul>${c.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`;
    }
    case SectionType.EDUCATION: {
      const c = content as EducationContentDto;
      return `<p><strong>${c.degree}${c.fieldOfStudy ? `, ${c.fieldOfStudy}` : ''}</strong>, ${c.institution} (${c.startDate}–${c.endDate ?? 'Present'})</p>`;
    }
    case SectionType.SKILLS: {
      const c = content as SkillsContentDto;
      return `<ul>${c.items.map((s) => `<li>${s}</li>`).join('')}</ul>`;
    }
    case SectionType.PROJECTS: {
      const c = content as ProjectsContentDto;
      return `<p><strong>${c.name}</strong></p><p>${c.description}</p><p>${c.technologies.join(', ')}</p>`;
    }
    case SectionType.CERTIFICATIONS: {
      const c = content as CertificationsContentDto;
      return `<p>${c.name} — ${c.issuer} (${c.issueDate})</p>`;
    }
    case SectionType.LANGUAGES: {
      const c = content as LanguagesContentDto;
      return `<p>${c.language} — ${c.proficiency}</p>`;
    }
    default:
      return '';
  }
}

export function renderCvTemplate(cv: Cv): string {
  const sorted = [...cv.sections].sort((a, b) => a.order - b.order);

  // Group consecutive-by-appearance sections by type, preserving first-seen order
  const order: SectionType[] = [];
  const groups = new Map<SectionType, typeof sorted>();
  for (const s of sorted) {
    if (!groups.has(s.type)) {
      groups.set(s.type, []);
      order.push(s.type);
    }
    groups.get(s.type)!.push(s);
  }

  const body = order
    .map((type) => {
      const entries = groups.get(type)!;
      const heading = SECTION_HEADINGS[type];
      const entriesHtml = entries
        .map((s) => renderEntry(type, s.content))
        .join('');
      return heading ? `<h2>${heading}</h2>${entriesHtml}` : entriesHtml;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLES}</style></head><body>${body}</body></html>`;
}
