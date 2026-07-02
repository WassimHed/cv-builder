import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { StorageBackend } from '../../storage/interfaces/storage-backend.enum';

export enum SectionType {
  PERSONAL_INFO = 'personalInfo',
  EXPERIENCE = 'experience',
  EDUCATION = 'education',
  SKILLS = 'skills',
  PROJECTS = 'projects',
  CERTIFICATIONS = 'certifications',
  LANGUAGES = 'languages',
}

export enum CvStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Schema({ _id: false })
export class Section {
  @Prop({ required: true, enum: SectionType })
  type!: SectionType;

  @Prop({ required: true })
  order!: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  content!: unknown;
}

const SectionSchema = SchemaFactory.createForClass(Section);

@Schema({ timestamps: true, collection: 'cvs' })
export class Cv extends Document {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  targetRole?: string;

  @Prop({ required: true, enum: CvStatus, default: CvStatus.DRAFT })
  status!: CvStatus;

  @Prop({ type: [SectionSchema], default: [] })
  sections!: Section[];

  @Prop()
  pdfKey?: string; // e.g. "cv-pdfs/<cvId>.pdf"

  @Prop({ type: String, enum: StorageBackend })
  pdfBackend?: StorageBackend;
}

export const CvSchema = SchemaFactory.createForClass(Cv);
