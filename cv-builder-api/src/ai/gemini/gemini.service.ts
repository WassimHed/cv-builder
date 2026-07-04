import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly ai: GoogleGenAI;
  private readonly model = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set — AI calls will fail at runtime.',
      );
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson<T = any>(prompt: string): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
    });

    const text = response.text?.trim() ?? '';
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      this.logger.error(`Gemini response was not valid JSON: ${text}`);
      throw new Error('AI response was not valid JSON');
    }
  }
}
