import { PartialType } from '@nestjs/swagger';
import { CreateMotivationLetterDto } from './create-motivation-letter.dto';

export class UpdateMotivationLetterDto extends PartialType(
  CreateMotivationLetterDto as new () => CreateMotivationLetterDto,
) {}
