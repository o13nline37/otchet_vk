// Личный список Google-таблиц пользователя — те, в которые он успешно выгружал
// отчёты. Подставляется в автодополнение поля ссылки (см. js/savedSpreadsheets.js).
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listSavedSpreadsheets, upsertSavedSpreadsheet } from '../db.js';

const MAX_SPREADSHEET_ID_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;

export const spreadsheetsRouter = Router();

spreadsheetsRouter.get('/', requireAuth, async (req, res) => {
    try {
        const spreadsheets = await listSavedSpreadsheets(req.auth.userId);
        return res.json({ spreadsheets });
    } catch (error) {
        console.error('❌ Ошибка чтения сохранённых таблиц:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

spreadsheetsRouter.post('/', requireAuth, async (req, res) => {
    const spreadsheetId = String(req.body?.spreadsheetId || '').trim();
    const title = String(req.body?.title || '').trim().slice(0, MAX_TITLE_LENGTH) || null;

    if (!spreadsheetId || spreadsheetId.length > MAX_SPREADSHEET_ID_LENGTH) {
        return res.status(400).json({ error: 'Некорректный ID таблицы' });
    }

    try {
        const spreadsheet = await upsertSavedSpreadsheet(req.auth.userId, { spreadsheetId, title });
        return res.json({ spreadsheet });
    } catch (error) {
        console.error('❌ Ошибка сохранения таблицы:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
