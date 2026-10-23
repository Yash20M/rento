import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/kysely';
import { KYSELY } from '../../db/tokens';
import { DATABASE_PING } from './database-ping';
import { HealthController } from './health.controller';
import { KyselyDatabasePing } from './kysely-database-ping';
import { ShutdownState } from './shutdown-state';

@Module({
  controllers: [HealthController],
  providers: [
    ShutdownState,
    {
      provide: DATABASE_PING,
      inject: [KYSELY],
      useFactory: (db: Kysely<Database>) => new KyselyDatabasePing(db),
    },
  ],
  exports: [ShutdownState],
})
export class HealthModule {}
