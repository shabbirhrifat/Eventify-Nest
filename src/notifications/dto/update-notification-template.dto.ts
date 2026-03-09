import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subjectTemplate?: string;

  @IsOptional()
  @IsString()
  htmlTemplate?: string;

  @IsOptional()
  @IsString()
  textTemplate?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
