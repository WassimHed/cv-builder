import { IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class RequestAcceptCvSuggestionDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  acceptedIndexes?: number[];
}
