// Маршруты аутентификации.
import { Router } from 'express';
import { verifyGoogleAccessToken } from './googleVerify.js';
import { isEmailAllowed } from './allowlist.js';
import { issueSessionToken } from './jwt.js';
import { upsertUser, getUserById } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();

// Публичное представление пользователя (без внутренних полей).
function toPublicUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.picture_url,
    };
}

// POST /api/auth/google
// Вход/регистрация: принимает Google access token (запрошен фронтендом сразу со
// scope профиля и Google Таблиц), проверяет его и whitelist, заводит/обновляет
// пользователя, возвращает наш сессионный токен.
authRouter.post('/google', async (req, res) => {
    const accessToken = req.body?.accessToken;

    let profile;
    try {
        profile = await verifyGoogleAccessToken(accessToken);
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }

    if (!isEmailAllowed(profile.email)) {
        return res.status(403).json({
            error: 'Доступ разрешён только сотрудникам 108 Media. Обратитесь к администратору.',
        });
    }

    let user;
    try {
        user = await upsertUser(profile);
    } catch (error) {
        console.error('❌ Ошибка записи пользователя:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }

    const token = issueSessionToken(user);
    return res.json({ token, user: toPublicUser(user) });
});

// GET /api/auth/me
// Проверка текущей сессии: по валидному JWT возвращает актуального пользователя.
authRouter.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await getUserById(req.auth.userId);
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        return res.json({ user: toPublicUser(user) });
    } catch (error) {
        console.error('❌ Ошибка чтения пользователя:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// POST /api/auth/logout
// Токены stateless, поэтому серверного состояния для выхода нет: фронтенд просто
// удаляет токен из localStorage. Эндпоинт оставлен для симметрии и будущего чёрного списка.
authRouter.post('/logout', (req, res) => {
    return res.json({ ok: true });
});
