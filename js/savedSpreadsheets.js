// Личный список Google-таблиц пользователя, в которые он успешно выгружал отчёты.
// Используется для автодополнения поля ссылки на таблицу (см. ui.js).
import { authFetch } from './apiClient.js';

const ENDPOINT = '/api/spreadsheets';

export async function loadSavedSpreadsheets() {
    try {
        const response = await authFetch(ENDPOINT);
        if (!response.ok) return [];
        const { spreadsheets } = await response.json();
        return Array.isArray(spreadsheets) ? spreadsheets : [];
    } catch {
        return [];
    }
}

// Не блокирует экспорт отчёта — ошибка сохранения тихо игнорируется.
export function rememberSpreadsheet(spreadsheetId, title) {
    if (!spreadsheetId) return;

    authFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, title }),
        keepalive: true,
    }).catch(() => {});
}
