import { db } from '../db/client';
import type { ScoringConfigKey, ScoringConfigRow } from '../types/entities';

export const ScoringConfigModel = {
  async list(): Promise<ScoringConfigRow[]> {
    const result = await db.query<ScoringConfigRow>(
      'SELECT * FROM fn_scoring_config_list()',
    );
    return result.rows;
  },

  async set(
    key: ScoringConfigKey,
    value: number,
    user_id: number,
  ): Promise<ScoringConfigRow> {
    const row = await db.queryOne<ScoringConfigRow>(
      'SELECT * FROM sp_scoring_config_set($1, $2, $3)',
      [key, value, user_id],
    );
    if (!row) throw new Error('sp_scoring_config_set returned no row');
    return row;
  },
};
