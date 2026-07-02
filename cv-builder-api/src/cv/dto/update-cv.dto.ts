import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCvDto } from './create-cv.dto';

export class UpdateCvDto extends PartialType(
  OmitType(CreateCvDto, ['sections'] as const),
) {}
