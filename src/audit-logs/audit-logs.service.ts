import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async record(
    action: string,
    entity: string,
    actorUserId?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        entity,
        actorUserId: actorUserId ?? null,
        metadata: metadata ?? null,
      });

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Audit log write failed: ${message}`);
    }
  }
}
