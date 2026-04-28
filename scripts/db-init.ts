import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || './data/legal-ai.db';
const schemaPath = path.join(process.cwd(), 'scripts/schema.sql');

const db = new Database(dbPath);
const schema = readFileSync(schemaPath, 'utf8');
db.exec(schema);
db.close();

console.log(`Database initialized at ${dbPath}`);
