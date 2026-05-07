import { db, pool } from '../src/lib/db.js';
import { DATABASE_SCHEMA_SQL } from '../src/lib/dbSchema.js';
import { ensureQuestionBankSeeded } from '../src/lib/questionBankStore.js';

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runMigrationOnce() {
  await db.execute(DATABASE_SCHEMA_SQL);
  await ensureQuestionBankSeeded();
}

async function migrate() {
  try {
    const maxAttempts = Number(process.env.DB_MIGRATE_ATTEMPTS ?? 3);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await runMigrationOnce();
        break;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        const delay = attempt * 2000;
        console.warn(`Migration connection failed on attempt ${attempt}. Retrying in ${delay / 1000}s...`);
        await wait(delay);
      }
    }
    console.log('All tables created successfully on Neon.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void migrate();
