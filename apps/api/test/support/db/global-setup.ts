import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../../../src/db/migrate';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Superuser connection URI of the shared PostGIS test container. */
    dbAdminUrl: string;
    /** Fully migrated database every test database is cloned from. */
    dbTemplateName: string;
  }
}

const TEMPLATE_NAME = 'rento_template';

let container: StartedPostgreSqlContainer | undefined;

/**
 * One real PostgreSQL+PostGIS container for the whole `db` project (README §16 / plan §6). The schema is
 * migrated once into a template database; each test file clones it (fast, isolated, no migration cost).
 */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withUsername('rento')
    .withPassword('rento')
    .withDatabase('postgres')
    .start();
  const adminUrl = container.getConnectionUri();

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${TEMPLATE_NAME}`);
  } finally {
    await admin.end();
  }

  const templateUrl = new URL(adminUrl);
  templateUrl.pathname = `/${TEMPLATE_NAME}`;
  await runMigrations(templateUrl.toString());

  project.provide('dbAdminUrl', adminUrl);
  project.provide('dbTemplateName', TEMPLATE_NAME);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
