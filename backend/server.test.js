// tests/setup.ts
import { Pool } from 'pg';
import * as dbConfig from '../src/config/database';

export const testPool = new Pool({
  ...dbConfig,
  database: 'estates_test',
});