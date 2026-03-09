import { PickType } from '@nestjs/mapped-types';
import { RegisterUserDto } from '../../users/dto/register-user.dto';

export class LoginDto extends PickType(RegisterUserDto, [
  'email',
  'password',
] as const) {}
