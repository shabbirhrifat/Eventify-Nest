import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  profile: {
    id: string;
    fullName: string;
    phone: string | null;
    city: string | null;
    organization: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}
