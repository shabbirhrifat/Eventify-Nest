import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { IdempotencyKey } from './entities/idempotency-key.entity';

type ReserveOrReplayResult =
  | { type: 'reserved'; record: IdempotencyKey }
  | { type: 'replay'; record: IdempotencyKey };

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepository: Repository<IdempotencyKey>,
    private readonly configService: ConfigService,
  ) {}

  createRequestHash(payload: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(payload) ?? 'null')
      .digest('hex');
  }

  async reserveOrReplay(
    key: string,
    scope: string,
    userId: string,
    requestHash: string,
  ): Promise<ReserveOrReplayResult> {
    const existing = await this.idempotencyRepository.findOne({
      where: { key, scope },
    });

    if (!existing) {
      const ttlHours =
        this.configService.get<number>('security.idempotencyTtlHours') ?? 24;
      const reservation = this.idempotencyRepository.create({
        key,
        scope,
        userId,
        requestHash,
        responseBody: null,
        statusCode: null,
        completed: false,
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      });
      await this.idempotencyRepository.save(reservation);
      return { type: 'reserved' as const, record: reservation };
    }

    if (existing.expiresAt < new Date()) {
      await this.idempotencyRepository.remove(existing);
      return this.reserveOrReplay(key, scope, userId, requestHash);
    }

    if (existing.userId !== userId) {
      throw new UnauthorizedException(
        'Idempotency key belongs to another user.',
      );
    }

    if (existing.requestHash !== requestHash) {
      throw new ConflictException(
        'This idempotency key was already used with a different payload.',
      );
    }

    if (existing.completed && existing.responseBody && existing.statusCode) {
      return { type: 'replay' as const, record: existing };
    }

    throw new ConflictException(
      'A request with this idempotency key is still processing.',
    );
  }

  async complete(
    idempotencyRecordId: string,
    statusCode: number,
    responseBody: Record<string, unknown>,
  ) {
    const record = await this.idempotencyRepository.findOne({
      where: { id: idempotencyRecordId },
    });

    if (!record) {
      return;
    }

    record.completed = true;
    record.statusCode = statusCode;
    record.responseBody = responseBody;
    await this.idempotencyRepository.save(record);
  }
}
