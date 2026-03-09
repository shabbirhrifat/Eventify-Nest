import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
