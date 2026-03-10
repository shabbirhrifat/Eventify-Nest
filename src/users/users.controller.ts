import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountStatusGuard } from '../common/guards/account-status.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import {
  createImageFileValidationPipe,
  createImageUploadOptions,
} from '../common/utils/file-upload.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

const avatarUploadOptions = createImageUploadOptions('avatars');
const avatarValidationPipe = createImageFileValidationPipe(5 * 1024 * 1024);

@Controller('users')
@UseGuards(JwtAuthGuard, AccountStatusGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUserId() userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Patch('password')
  changePassword(
    @CurrentUserId() userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  uploadAvatar(
    @CurrentUserId() userId: string,
    @UploadedFile(avatarValidationPipe)
    file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(userId, file.filename);
  }

  @Delete('account')
  deleteAccount(@CurrentUserId() userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}
