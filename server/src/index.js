// Точка входа бэкенда: сборка Express-приложения, CORS, маршруты, запуск.
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './auth/routes.js';
import { settingsRouter } from './settings/routes.js';

const app = express();

// Разбор JSON-тел запросов. ID-токены Google небольшие — ограничиваем размер.
app.use(express.json({ limit: '64kb' }));

// CORS: фронтенд (GitHub Pages / localhost) и бэкенд на разных доменах.
// Токен ходит в заголовке Authorization, а не в cookie, поэтому credentials не нужны.
app.use(cors({
    origin(origin, callback) {
        // Разрешаем запросы без Origin (curl, health-checks) и из списка CORS_ORIGIN.
        if (!origin || config.corsOrigins.includes(origin.toLowerCase())) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} не разрешён политикой CORS`));
    },
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Проверка живости сервиса.
app.get('/health', (req, res) => res.json({ ok: true }));

// Маршруты аутентификации.
app.use('/api/auth', authRouter);

// Личные настройки пользователя.
app.use('/api/settings', settingsRouter);

// Единый обработчик ошибок (в т.ч. отказ CORS выше).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('❌ Необработанная ошибка:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

app.listen(config.port, () => {
    console.log(`✅ Сервер запущен на http://localhost:${config.port}`);
});
