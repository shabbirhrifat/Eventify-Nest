import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
