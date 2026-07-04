export function buildLetterDraftPrompt(
  cvSummary: string,
  programName: string,
  programDescription?: string,
  tone = 'formal',
  language = 'fr',
  currentDate?: string,
  academicYear?: string,
): string {
  return [
    `Write a motivation letter draft in ${language === 'fr' ? 'French' : 'English'}.`,
    `Target program: ${programName}.`,
    programDescription ? `Program description: ${programDescription}.` : '',
    `Tone: ${tone}.`,
    currentDate
      ? `Current date: ${currentDate}. Use it directly instead of any [Date] placeholder.`
      : '',
    academicYear
      ? `Academic year: ${academicYear}. Use it directly instead of any 202X-202X placeholder.`
      : '',
    'Candidate background summary:',
    cvSummary,
    '',
    'Return ONLY valid JSON in this exact shape, no extra text:',
    '{ "draft": string, "keyPointsUsed": string[] }',
  ]
    .filter(Boolean)
    .join('\n');
}
