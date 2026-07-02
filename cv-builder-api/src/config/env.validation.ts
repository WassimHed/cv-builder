import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  PORT!: number;

  @IsString()
  DB_HOST!: string;

  @IsNumber()
  DB_PORT!: number;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_DATABASE!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRATION_TIME!: string;

  @IsString()
  MONGODB_URI!: string;

  @IsString()
  MINIO_ENDPOINT!: string;

  @IsNumber()
  MINIO_API_PORT!: number;

  @IsString()
  MINIO_ROOT_USER!: string;

  @IsString()
  MINIO_ROOT_PASSWORD!: string;

  @IsString()
  MINIO_BUCKET!: string;

  @IsString()
  LOCAL_STORAGE_PATH!: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
