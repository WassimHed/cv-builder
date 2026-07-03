// src/pdf/templates/letter.template.ts
import { MotivationLetter } from '../../letters/schemas/motivation-letter.schema';

export function renderLetterTemplate(letter: MotivationLetter): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; margin: 0; }
  </style></head><body>${letter.content.replace(/\n/g, '<br>')}</body></html>`;
}
