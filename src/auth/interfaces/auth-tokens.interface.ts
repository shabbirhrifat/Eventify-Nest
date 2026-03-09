import { UserResponse } from '../../users/interfaces/user-response.interface';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  refreshExpiresIn: string;
  user: UserResponse;
}
