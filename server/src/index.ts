import { PORT, NODE_ENV } from './config/env';
import { pool } from './config/database';
import app from './app';

async function main() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', (error as Error).message);
    process.exit(1);
  }
}

main();
