import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'motivation_letters' })
export class MotivationLetter extends Document {
  @Prop({ required: true })
  userId!: string;

  @Prop()
  cvId?: string;

  @Prop()
  targetCompany?: string;

  @Prop()
  targetRole?: string;

  @Prop({ required: true })
  content!: string;
}

export const MotivationLetterSchema =
  SchemaFactory.createForClass(MotivationLetter);
