// Применяет server/db/schema.sql к базе из DATABASE_URL.
// Запуск: npm run db:init
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'db', 'schema.sql');

async function main() {
    const sql = await readFile(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Схема БД применена (server/db/schema.sql).');
}

main()
    .catch((error) => {
        console.error('❌ Не удалось применить схему:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
