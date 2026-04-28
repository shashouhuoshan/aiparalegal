import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';
import { generateId } from '../lib/id';

const args = process.argv.slice(2);
const emailIndex = args.indexOf('--email');
const nameIndex = args.indexOf('--name');

const email = emailIndex !== -1 ? args[emailIndex + 1] : undefined;
const name = nameIndex !== -1 ? args[nameIndex + 1] : undefined;

if (!email) {
  console.error('Usage: pnpm tsx scripts/invite.ts --email user@example.com [--name "姓名"]');
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || './data/legal-ai.db';
const token = generateId(16);

const db = new Database(dbPath);
const schemaPath = path.join(process.cwd(), 'scripts/schema.sql');
db.exec(readFileSync(schemaPath, 'utf8'));
db.prepare('INSERT INTO users (token, email, name) VALUES (?,?,?)').run(token, email, name ?? null);
db.close();

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
console.log(`\n✅ 邀请链接已生成`);
console.log(`用户: ${name ?? '未命名'} <${email}>`);
console.log(`链接: ${baseUrl}/?t=${token}\n`);
