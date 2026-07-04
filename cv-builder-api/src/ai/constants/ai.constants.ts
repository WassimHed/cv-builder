export const AI_QUEUE = 'ai-processing';

export enum AiJobType {
  CV_SUGGESTION = 'cv-suggestion',
  LETTER_DRAFT = 'letter-draft',
}

export enum AiJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
