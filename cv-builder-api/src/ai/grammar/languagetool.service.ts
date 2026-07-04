import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface GrammarIssue {
  message: string;
  offset: number;
  length: number;
  replacements: string[];
  context: string;
}

interface LanguageToolReplacement {
  value: string;
}

interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements?: LanguageToolReplacement[];
  context?: { text: string };
}

interface LanguageToolResponse {
  matches?: LanguageToolMatch[];
}

@Injectable()
export class LanguageToolService {
  private readonly logger = new Logger(LanguageToolService.name);
  private readonly endpoint =
    process.env.LANGUAGETOOL_URL ?? 'https://api.languagetool.org/v2/check';

  async check(text: string, language = 'auto'): Promise<GrammarIssue[]> {
    try {
      const { data } = await axios.post<LanguageToolResponse>(
        this.endpoint,
        new URLSearchParams({ text, language }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      return (data.matches ?? []).map((match) => ({
        message: match.message,
        offset: match.offset,
        length: match.length,
        replacements: (match.replacements ?? [])
          .map((r) => r.value)
          .slice(0, 3),
        context: match.context?.text ?? '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`LanguageTool check failed: ${message}`);
      return [];
    }
  }
}
