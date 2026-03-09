import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { UserStatus } from '../enums/user-status.enum';

@Injectable()
export class AccountStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      return true;
    }

    if (request.user.status !== UserStatus.Active) {
      throw new ForbiddenException('Your account is suspended.');
    }

    return true;
  }
}
