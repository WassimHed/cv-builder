import { SectionType } from '../../cv/schemas/cv.schema';

export function buildCvSuggestionPrompt(
  sectionType: SectionType,
  content: unknown,
  targetRole?: string,
): string {
  return [
    'You are an expert CV writer helping a candidate improve one section of their CV.',
    `Section type: ${sectionType}.`,
    'Focus on clarity, strong action verbs, and ATS-friendly phrasing.',
    targetRole ? `The candidate is targeting this role: ${targetRole}.` : '',
    '',
    'IMPORTANT — quantifiable impact: only mention specific numbers, percentages, or metrics if they are already present in the original content below. Do NOT invent, estimate, or insert placeholder values like "X%", "Y hours", "20%", or similar — even as illustrative examples. If no real metric exists in the source content, describe the impact qualitatively instead (e.g. "significantly reduced manual effort" rather than "reduced effort by X%").',
    '',
    'Current content (JSON):',
    JSON.stringify(content),
    '',
    'Return ONLY valid JSON in this exact shape, no extra text:',
    '{ "suggestions": [ { "original": string, "improved": string, "reason": string } ] }',
  ]
    .filter(Boolean)
    .join('\n');
}
