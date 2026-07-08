// Middleware для защищённых маршрутов: требует валидный сессионный JWT
// в заголовке `Authorization: Bearer <token>`. Кладёт { userId, email } в req.auth.
import { verifySessionToken } from '../auth/jwt.js';

export function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    try {
        req.auth = verifySessionToken(token);
        return next();
    } catch {
        return res.status(401).json({ error: 'Сессия недействительна или истекла' });
    }
}
