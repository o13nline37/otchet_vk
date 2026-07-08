// Централизованное чтение и валидация переменных окружения.
// Значения приходят из server/.env (через `node --env-file=.env`, см. package.json).

function readList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0);
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`❌ Не задана обязательная переменная окружения ${name} (см. server/.env.example)`);
    }
    return value.trim();
}

export const config = {
    port: Number(process.env.PORT) || 3000,
    corsOrigins: readList(process.env.CORS_ORIGIN),

    googleClientId: requireEnv('GOOGLE_CLIENT_ID'),

    allowedEmailDomains: readList(process.env.ALLOWED_EMAIL_DOMAINS),
    allowedEmails: readList(process.env.ALLOWED_EMAILS),

    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

    databaseUrl: requireEnv('DATABASE_URL'),
    databaseSsl: String(process.env.DATABASE_SSL || 'require').trim().toLowerCase() !== 'disable',
};

// Ранняя защита от запуска с дефолтным секретом.
if (config.jwtSecret === 'change-me-to-a-long-random-string') {
    throw new Error('❌ JWT_SECRET оставлен дефолтным. Сгенерируйте случайный секрет (см. server/.env.example).');
}

// Если whitelist полностью пуст — это почти наверняка ошибка конфигурации: пускать будет всех.
if (config.allowedEmailDomains.length === 0 && config.allowedEmails.length === 0) {
    throw new Error(
        '❌ Whitelist пуст: заданы ни ALLOWED_EMAIL_DOMAINS, ни ALLOWED_EMAILS. ' +
        'Иначе доступ получит любой Google-аккаунт. Заполните хотя бы одно (см. server/.env.example).'
    );
}
