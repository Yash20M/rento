import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/config.module';
import { type Database, createDb } from './kysely';
import { createPool } from './pool';
import { KYSELY, PG_POOL } from './tokens';
import { TransactionManager } from './transaction';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Pool => createPool(config),
    },
    {
      provide: KYSELY,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Kysely<Database> => createDb(pool),
    },
    TransactionManager,
  ],
  exports: [PG_POOL, KYSELY, TransactionManager],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /** Ends the pool (Kysely owns it) — runs during graceful shutdown. */
  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
