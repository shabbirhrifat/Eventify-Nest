import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  tokenId?: string;
}
