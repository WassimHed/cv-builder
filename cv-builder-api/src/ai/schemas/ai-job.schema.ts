import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AiJobType, AiJobStatus } from '../constants/ai.constants';

export type AiJobDocument = AiJob & Document;

@Schema({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (_doc, ret) => {
      const plain = ret as Record<string, unknown> & {
        _id: unknown;
        targetId?: unknown;
      };

      plain._id = String(plain._id);
      if ('targetId' in plain) {
        plain.targetId = String(plain.targetId);
      }

      return plain;
    },
  },
  toObject: {
    versionKey: false,
    transform: (_doc, ret) => {
      const plain = ret as Record<string, unknown> & {
        _id: unknown;
        targetId?: unknown;
      };

      plain._id = String(plain._id);
      if ('targetId' in plain) {
        plain.targetId = String(plain.targetId);
      }

      return plain;
    },
  },
})
export class AiJob {
  @Prop({ required: true, enum: AiJobType })
  type!: AiJobType;

  @Prop({ required: true, type: Types.ObjectId })
  targetId!: Types.ObjectId;

  @Prop({ type: String, default: null })
  sectionType!: string | null;

  @Prop({ type: Number, default: null })
  sectionOrder!: number | null;

  @Prop({ type: Object, default: null })
  metadata!: Record<string, unknown> | null;

  @Prop({ required: true, type: String })
  userId!: string;

  @Prop({ required: true, enum: AiJobStatus, default: AiJobStatus.PENDING })
  status!: AiJobStatus;

  @Prop({ type: Object, default: null })
  result!: Record<string, any> | null;

  @Prop({ type: Object, default: null })
  grammarIssues!: Record<string, any> | null;

  @Prop({ type: String, default: null })
  error!: string | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;
}
export const AiJobSchema = SchemaFactory.createForClass(AiJob);
