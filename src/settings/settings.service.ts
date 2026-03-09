import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SystemSetting } from './entities/system-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
  ) {}

  getAll() {
    return this.settingsRepository.find({ order: { key: 'ASC' } });
  }

  async updateMany(updateSettingsDto: UpdateSettingsDto) {
    const savedSettings: SystemSetting[] = [];

    for (const item of updateSettingsDto.items) {
      const existing = await this.settingsRepository.findOne({
        where: { key: item.key },
      });

      const entity = existing
        ? this.settingsRepository.merge(existing, {
            value: item.value,
            description: item.description ?? existing.description,
          })
        : this.settingsRepository.create({
            key: item.key,
            value: item.value,
            description: item.description ?? null,
          });

      savedSettings.push(await this.settingsRepository.save(entity));
    }

    return savedSettings;
  }
}
