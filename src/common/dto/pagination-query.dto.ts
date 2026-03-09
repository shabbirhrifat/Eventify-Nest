import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'string'
    ? Number(value)
    : ((value as number) ?? fallback);
}

export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toNumber(value, 1))
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => toNumber(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
