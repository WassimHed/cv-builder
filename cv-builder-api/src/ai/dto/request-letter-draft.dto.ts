import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentAcademicYear(): string {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
}

export class RequestLetterDraftDto {
  @IsNotEmpty()
  @IsString()
  programName!: string;

  @IsOptional()
  @IsString()
  programDescription?: string;

  @IsOptional()
  @IsString()
  targetCompany?: string;

  @IsOptional()
  @IsString()
  tone?: string; // 'formal' | 'enthusiastic'

  @IsOptional()
  @IsString()
  language?: string; // 'fr' | 'en'

  @IsOptional()
  @IsString()
  currentDate?: string = getTodayDateString();

  @IsOptional()
  @IsString()
  academicYear?: string = getCurrentAcademicYear();
}
