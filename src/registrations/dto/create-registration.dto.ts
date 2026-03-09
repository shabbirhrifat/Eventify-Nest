import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRegistrationDto {
  @IsOptional()
  @IsObject()
  selectedPriceOption?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
