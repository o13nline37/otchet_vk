// Выпуск и проверка нашего собственного сессионного JWT.
// После верификации Google-токена мы выдаём фронтенду этот токен, а он кладёт его
// в localStorage и присылает в заголовке Authorization при каждом запросе.
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Создаёт сессионный токен для пользователя. subject = внутренний user.id.
export function issueSessionToken(user) {
    return jwt.sign(
        { email: user.email },
        config.jwtSecret,
        {
            subject: String(user.id),
            expiresIn: config.jwtExpiresIn,
        }
    );
}

// Проверяет сессионный токен. Возвращает { userId, email } или бросает Error.
export function verifySessionToken(token) {
    const payload = jwt.verify(token, config.jwtSecret);
    return {
        userId: Number(payload.sub),
        email: payload.email,
    };
}
