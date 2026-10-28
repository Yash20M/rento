import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Factories, createFactories } from '../factories';
import { expectPgError } from '../support/db/pg-assert';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const CHECK_VIOLATION = '23514';

let db: TestDatabase;
let f: Factories;
beforeAll(async () => {
  db = await createTestDatabase();
  f = createFactories(db.db);
});
afterAll(async () => {
  await db.drop();
});

const setOffer = (id: string, sets: string) =>
  db.pool.query(`UPDATE item_models SET ${sets} WHERE id = $1`, [id]);
const promotion = (cols: string, values: unknown[]) =>
  db.pool.query(
    `INSERT INTO promotions (${cols}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})`,
    values,
  );

describe('offers on item models (M29)', () => {
  it('MD-1 a new model has no offer and is not featured', async () => {
    const m = await f.itemModel();
    const { rows } = await db.pool.query(
      'SELECT discount_percent, discount_starts_at, discount_ends_at, featured FROM item_models WHERE id = $1',
      [m.id],
    );
    expect(rows[0]).toEqual({
      discount_percent: null,
      discount_starts_at: null,
      discount_ends_at: null,
      featured: false,
    });
  });

  it('MD-2 the percent is 1..90', async () => {
    const m = await f.itemModel();
    for (const bad of [0, -1, 91, 100]) {
      await expectPgError(setOffer(m.id, `discount_percent = ${bad}`), { code: CHECK_VIOLATION });
    }
    for (const good of [1, 50, 90]) await setOffer(m.id, `discount_percent = ${good}`);
  });

  it('MD-3 dates without a percent are refused', async () => {
    const m = await f.itemModel();
    await expectPgError(setOffer(m.id, `discount_ends_at = now() + interval '1 day'`), {
      code: CHECK_VIOLATION,
      constraint: 'item_models_offer_needs_percent',
    });
    await expectPgError(setOffer(m.id, `discount_starts_at = now()`), {
      code: CHECK_VIOLATION,
      constraint: 'item_models_offer_needs_percent',
    });
  });

  it('MD-4 the window must end after it starts (an open end or an open start is fine)', async () => {
    const m = await f.itemModel();
    await expectPgError(
      setOffer(
        m.id,
        `discount_percent = 10, discount_starts_at = now(), discount_ends_at = now() - interval '1 hour'`,
      ),
      { code: CHECK_VIOLATION, constraint: 'item_models_offer_window_order' },
    );
    await setOffer(
      m.id,
      `discount_percent = 10, discount_starts_at = now(), discount_ends_at = NULL`,
    );
    await setOffer(m.id, `discount_starts_at = NULL, discount_ends_at = now() + interval '1 day'`);
  });

  it('MD-5 clearing the percent while dates remain is refused (clear all three together)', async () => {
    const m = await f.itemModel();
    await setOffer(m.id, `discount_percent = 10, discount_ends_at = now() + interval '1 day'`);
    await expectPgError(setOffer(m.id, `discount_percent = NULL`), {
      code: CHECK_VIOLATION,
      constraint: 'item_models_offer_needs_percent',
    });
    await setOffer(m.id, `discount_percent = NULL, discount_ends_at = NULL`);
  });
});

describe('what a booking saved (M29)', () => {
  it('MD-6 the saving defaults to 0 and can never be negative', async () => {
    const b = await f.booking();
    const { rows } = await db.pool.query('SELECT discount_paise FROM bookings WHERE id = $1', [
      b.id,
    ]);
    expect(rows[0].discount_paise).toBe(0);
    await expectPgError(
      db.pool.query('UPDATE bookings SET discount_paise = -1 WHERE id = $1', [b.id]),
      { code: CHECK_VIOLATION },
    );
  });
});

describe('promotions (banners)', () => {
  it('MD-7 a minimal banner is valid and defaults to active, orange, order 0', async () => {
    await promotion('title', ['Weekend offer']);
    const { rows } = await db.pool.query(
      `SELECT theme, active, sort_order FROM promotions WHERE title = 'Weekend offer'`,
    );
    expect(rows[0]).toEqual({ theme: 'orange', active: true, sort_order: 0 });
  });

  it('MD-8 the title is 1..80 characters, the subtitle 1..160, the button label 1..30', async () => {
    await expectPgError(promotion('title', ['']), { code: CHECK_VIOLATION });
    await expectPgError(promotion('title', ['x'.repeat(81)]), { code: CHECK_VIOLATION });
    await promotion('title', ['x'.repeat(80)]);
    await expectPgError(promotion('title, subtitle', ['ok', 'y'.repeat(161)]), {
      code: CHECK_VIOLATION,
    });
    await expectPgError(promotion('title, cta_label', ['ok', 'z'.repeat(31)]), {
      code: CHECK_VIOLATION,
    });
  });

  it('MD-9 only the four known colour themes', async () => {
    await expectPgError(promotion('title, theme', ['t', 'neon']), { code: CHECK_VIOLATION });
    for (const theme of ['orange', 'ink', 'teal', 'plum'])
      await promotion('title, theme', ['t', theme]);
  });

  it('MD-10 the window must end after it starts; the order is 0..10000', async () => {
    await expectPgError(
      promotion('title, starts_at, ends_at', ['t', '2030-01-02T00:00:00Z', '2030-01-01T00:00:00Z']),
      { code: CHECK_VIOLATION, constraint: 'promotions_window_order' },
    );
    await expectPgError(promotion('title, sort_order', ['t', -1]), { code: CHECK_VIOLATION });
    await expectPgError(promotion('title, sort_order', ['t', 10001]), { code: CHECK_VIOLATION });
  });

  it('MD-11 deleting the product a banner opens keeps the banner (it just opens nothing)', async () => {
    const m = await f.itemModel();
    await promotion('title, item_model_id', ['Opens a product', m.id]);
    await db.pool.query('DELETE FROM item_models WHERE id = $1', [m.id]);
    const { rows } = await db.pool.query(
      `SELECT item_model_id FROM promotions WHERE title = 'Opens a product'`,
    );
    expect(rows[0].item_model_id).toBeNull();
  });

  it('MD-12 deleting a banner picture keeps the banner (it falls back to the colour)', async () => {
    const { rows: media } = await db.pool.query(
      `INSERT INTO media (content_type, byte_size, sha256, data) VALUES ('image/png', 3, 'x', '\x010203') RETURNING id`,
    );
    await promotion('title, image_media_id', ['With picture', media[0].id]);
    await db.pool.query('DELETE FROM media WHERE id = $1', [media[0].id]);
    const { rows } = await db.pool.query(
      `SELECT image_media_id FROM promotions WHERE title = 'With picture'`,
    );
    expect(rows[0].image_media_id).toBeNull();
  });
});
