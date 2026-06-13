import pg from 'pg';
import { requirePostgresEnv } from '../config/env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const getPostgresPool = () => {
  if (!pool) {
    const { DATABASE_URL } = requirePostgresEnv();
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
    });
  }

  return pool;
};
