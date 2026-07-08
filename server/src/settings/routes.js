// Личные настройки пользователя: последние использованные множители, стиль Excel
// и формат вывода. Подставляются в форму при следующем визите (см. js/userSettings.js).
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getUserSettings, upsertUserSettings } from '../db.js';
import { normalizeSettings, DEFAULT_SETTINGS } from './validate.js';

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, async (req, res) => {
    try {
        const settings = await getUserSettings(req.auth.userId);
        return res.json({ settings: settings || DEFAULT_SETTINGS });
    } catch (error) {
        console.error('❌ Ошибка чтения настроек:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

settingsRouter.put('/', requireAuth, async (req, res) => {
    const settings = normalizeSettings(req.body);
    try {
        const saved = await upsertUserSettings(req.auth.userId, settings);
        return res.json({ settings: saved });
    } catch (error) {
        console.error('❌ Ошибка сохранения настроек:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
