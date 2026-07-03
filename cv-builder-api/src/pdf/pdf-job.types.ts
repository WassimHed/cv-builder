export enum PdfDocType {
  CV = 'cv',
  LETTER = 'letter',
}

export interface PdfJobData {
  docType: PdfDocType;
  docId: string;
  userId: string;
}
