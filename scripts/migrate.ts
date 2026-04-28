import { db, pool } from '../src/lib/db.js';
import { DATABASE_SCHEMA_SQL } from '../src/lib/dbSchema.js';

async function migrate() {
  try {
    await db.execute(DATABASE_SCHEMA_SQL);
    console.log('All tables created successfully on Neon.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void migrate();
