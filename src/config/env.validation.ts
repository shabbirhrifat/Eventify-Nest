import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Transform(({ value }) => Number(value ?? 3000))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsOptional()
  @IsString()
  APP_NAME: string = 'competition-registration-system';

  @IsOptional()
  @IsString()
  GLOBAL_PREFIX: string = 'api';

  @IsString()
  DB_HOST!: string;

  @Transform(({ value }) => Number(value ?? 5432))
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_DATABASE!: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean = true;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN: string = '15m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsOptional()
  @IsString()
  UPLOADS_ROOT_PATH: string = 'uploads';

  @IsOptional()
  @IsString()
  REDIS_HOST: string = '127.0.0.1';

  @Transform(({ value }) => Number(value ?? 6379))
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD: string = '';

  @Transform(({ value }) => Number(value ?? 0))
  @IsInt()
  @Min(0)
  REDIS_DB: number = 0;

  @IsOptional()
  @IsString()
  SMTP_HOST: string = 'localhost';

  @Transform(({ value }) => Number(value ?? 1025))
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 1025;

  @IsOptional()
  @IsString()
  SMTP_USER: string = '';

  @IsOptional()
  @IsString()
  SMTP_PASSWORD: string = '';

  @IsOptional()
  @IsString()
  SMTP_FROM_NAME: string = 'NestJS Blueprint';

  @IsOptional()
  @IsEmail()
  SMTP_FROM_EMAIL: string = 'no-reply@example.com';

  @Transform(({ value }) => Number(value ?? 24))
  @IsInt()
  @Min(1)
  @Max(168)
  IDEMPOTENCY_TTL_HOURS: number = 24;

  @Transform(({ value }) => Number(value ?? 3))
  @IsInt()
  @Min(1)
  @Max(20)
  EMAIL_QUEUE_ATTEMPTS: number = 3;

  @Transform(({ value }) => Number(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(20)
  REGISTRATION_QUEUE_ATTEMPTS: number = 5;
}

export function validateEnv(config: Record<string, unknown>) {
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
