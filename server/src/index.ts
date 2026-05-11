import { PORT, NODE_ENV } from './config/env';
import { pool } from './config/database';
import app from './app';
import { startScoringConfigListener } from './services/scoringConfig.service';

async function main() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully');

    // Subscribe to scoring_config_changed so direct DB edits invalidate the
    // in-memory weight cache. PUT /scoring-config also clears the cache
    // synchronously; this listener covers everything else (#20).
    await startScoringConfigListener();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', (error as Error).message);
    process.exit(1);
  }
}

main();
