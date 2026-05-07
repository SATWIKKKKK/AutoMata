import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Pool, type PoolClient, type QueryResult } from 'pg';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 30000),
});

pool.on('error', (error) => {
  console.error('Postgres pool error:', error);
});

export async function withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

function normalizeSql(sql: string): string {
  let placeholderIndex = 0;
  return sql.replace(/\?/g, () => {
    placeholderIndex += 1;
    return `$${placeholderIndex}`;
  });
}

export const db = {
  query: async <TRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<TRow[]> => {
    return withClient(async (client) => {
      const result = await client.query(text, params);
      return result.rows as TRow[];
    });
  },

  queryOne: async <TRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<TRow | null> => {
    return withClient(async (client) => {
      const result = await client.query(text, params);
      return (result.rows[0] as TRow | undefined) ?? null;
    });
  },

  execute: async (text: string, params: unknown[] = []): Promise<QueryResult> => {
    return withClient((client) => client.query(text, params));
  },

  exec: async (text: string): Promise<QueryResult> => {
    return withClient((client) => client.query(text));
  },

  prepare: (text: string) => {
    const normalizedText = normalizeSql(text);

    return {
      get: async <TRow = Record<string, unknown>>(...params: unknown[]): Promise<TRow | undefined> => {
        const result = await db.queryOne<TRow>(normalizedText, params);
        return result ?? undefined;
      },
      all: async <TRow = Record<string, unknown>>(...params: unknown[]): Promise<TRow[]> => {
        return db.query<TRow>(normalizedText, params);
      },
      run: async (...params: unknown[]): Promise<QueryResult> => {
        return db.execute(normalizedText, params);
      },
    };
  },
};

export { pool };
export default db;
