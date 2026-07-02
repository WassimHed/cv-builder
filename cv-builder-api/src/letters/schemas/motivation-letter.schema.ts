import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'motivation_letters',
  toJSON: {
    versionKey: false,
    transform: (_doc, ret) => {
      (ret as unknown as { _id: string })._id = ret._id.toString();
      return ret;
    },
  },
})
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
