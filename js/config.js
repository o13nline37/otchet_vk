// Единая конфигурация фронтенда.

// OAuth Client ID из Google Cloud Console. Это НЕ секрет — безопасно хранить в коде фронтенда.
// Используется и для входа на сайт (js/authGate.js), и для экспорта в Google Sheets (js/googleAuth.js).
export const GOOGLE_CLIENT_ID = '374654641527-uob0v52a95oe0ar9sfud3vai861l3r5t.apps.googleusercontent.com';

// Scope для доступа к Google Таблицам. Запрашивается сразу при входе на сайт
// (вместе со scope профиля), чтобы позже при экспорте отчёта не спрашивать доступ повторно.
export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Адрес бэкенда. Локально фронт открывается через http.server на :8000, бэкенд слушает :3000.
// В проде (GitHub Pages) укажите URL развёрнутого бэкенда.
const PROD_API_BASE_URL = 'https://otchet-vk.onrender.com';

function resolveApiBaseUrl() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    return PROD_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
