// Пул подключений к PostgreSQL и запросы к таблице users.
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: config.databaseUrl,
    // Облачные провайдеры (Neon/Supabase/Heroku) требуют SSL; локальный Postgres — обычно нет.
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (error) => {
    // Ошибка простаивающего клиента в пуле — логируем, но не роняем процесс.
    console.error('❌ Неожиданная ошибка клиента PostgreSQL:', error);
});

// Создаёт нового пользователя или обновляет данные существующего (по google_sub).
// Возвращает актуальную строку пользователя.
export async function upsertUser({ googleSub, email, name, pictureUrl }) {
    const query = `
        INSERT INTO users (google_sub, email, name, picture_url, last_login_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (google_sub) DO UPDATE
            SET email         = EXCLUDED.email,
                name          = EXCLUDED.name,
                picture_url   = EXCLUDED.picture_url,
                last_login_at = now()
        RETURNING id, google_sub, email, name, picture_url, created_at, last_login_at;
    `;
    const values = [googleSub, email, name || null, pictureUrl || null];
    const { rows } = await pool.query(query, values);
    return rows[0];
}

// Возвращает пользователя по внутреннему id или null.
export async function getUserById(id) {
    const query = `
        SELECT id, google_sub, email, name, picture_url, created_at, last_login_at
        FROM users
        WHERE id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

// Postgres возвращает NUMERIC как строку — приводим к удобному для JSON виду.
function toSettingsResponse(row) {
    return {
        vat: Number(row.vat),
        ak1: Number(row.ak1),
        ak2: Number(row.ak2),
        ak3: Number(row.ak3),
        fontName: row.font_name,
        fontSize: row.font_size,
        horizontalAlign: row.horizontal_align,
        verticalAlign: row.vertical_align,
        numberFormat: row.number_format,
        outputFormat: row.output_format,
    };
}

// Возвращает сохранённые настройки пользователя или null, если он их ещё не сохранял.
export async function getUserSettings(userId) {
    const query = `
        SELECT vat, ak1, ak2, ak3, font_name, font_size, horizontal_align, vertical_align, number_format, output_format
        FROM user_settings
        WHERE user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows[0] ? toSettingsResponse(rows[0]) : null;
}

// Создаёт или обновляет настройки пользователя (одна строка на пользователя).
export async function upsertUserSettings(userId, settings) {
    const query = `
        INSERT INTO user_settings
            (user_id, vat, ak1, ak2, ak3, font_name, font_size, horizontal_align, vertical_align, number_format, output_format, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        ON CONFLICT (user_id) DO UPDATE
            SET vat              = EXCLUDED.vat,
                ak1              = EXCLUDED.ak1,
                ak2              = EXCLUDED.ak2,
                ak3              = EXCLUDED.ak3,
                font_name        = EXCLUDED.font_name,
                font_size        = EXCLUDED.font_size,
                horizontal_align = EXCLUDED.horizontal_align,
                vertical_align   = EXCLUDED.vertical_align,
                number_format    = EXCLUDED.number_format,
                output_format    = EXCLUDED.output_format,
                updated_at       = now()
        RETURNING vat, ak1, ak2, ak3, font_name, font_size, horizontal_align, vertical_align, number_format, output_format;
    `;
    const values = [
        userId,
        settings.vat, settings.ak1, settings.ak2, settings.ak3,
        settings.fontName, settings.fontSize, settings.horizontalAlign, settings.verticalAlign,
        settings.numberFormat, settings.outputFormat,
    ];
    const { rows } = await pool.query(query, values);
    return toSettingsResponse(rows[0]);
}
