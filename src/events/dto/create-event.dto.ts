import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EventStatus } from '../../common/enums/event-status.enum';
import { PriceOptionDto } from './price-option.dto';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsDateString()
  registrationDeadline!: string;

  @IsString()
  @MaxLength(255)
  location!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAttendees?: number;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PriceOptionDto)
  priceOptions?: PriceOptionDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  cancellationPolicy?: Record<string, unknown>;
}
