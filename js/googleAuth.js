// Как получить GOOGLE_CLIENT_ID (один раз, в Google Cloud Console):
// 1. console.cloud.google.com -> создать/выбрать проект.
// 2. APIs & Services -> Library -> включить "Google Sheets API".
// 3. APIs & Services -> OAuth consent screen -> заполнить название приложения,
//    добавить свой аккаунт в Test users (пока приложение не верифицировано).
// 4. APIs & Services -> Credentials -> Create Credentials -> OAuth client ID ->
//    Application type: Web application.
// 5. Authorized JavaScript origins: добавить адрес, с которого открывается сайт,
//    например http://127.0.0.1:8000 (для локального теста) и/или домен GitHub Pages.
// 6. Скопировать "Client ID" (заканчивается на .apps.googleusercontent.com)
//    и вставить его значением константы GOOGLE_CLIENT_ID ниже.
// Client ID — это не секрет, его безопасно хранить прямо в коде фронтенда.

const GOOGLE_CLIENT_ID = '374654641527-uob0v52a95oe0ar9sfud3vai861l3r5t.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_SAFETY_MARGIN_MS = 60 * 1000;

let tokenClient = null;
let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

function getTokenClient() {
    if (tokenClient) return tokenClient;

    if (!window.google?.accounts?.oauth2) {
        throw new Error('⚠️ Google-авторизация не загрузилась. Проверьте интернет и обновите страницу.');
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SHEETS_SCOPE,
        callback: () => {},
    });

    return tokenClient;
}

function requestNewAccessToken() {
    return new Promise((resolve, reject) => {
        const client = getTokenClient();

        client.callback = (response) => {
            if (response.error) {
                reject(new Error(`⚠️ Google не выдал доступ к таблицам: ${response.error}`));
                return;
            }

            cachedAccessToken = response.access_token;
            cachedTokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
            resolve(cachedAccessToken);
        };

        client.error_callback = (error) => {
            reject(new Error(`⚠️ Не удалось открыть окно входа Google: ${error?.type || error}`));
        };

        client.requestAccessToken({ prompt: '' });
    });
}

export async function ensureAccessToken() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')) {
        throw new Error('⚠️ В js/googleAuth.js не указан корректный GOOGLE_CLIENT_ID (см. комментарий в начале файла)');
    }

    if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - TOKEN_SAFETY_MARGIN_MS) {
        return cachedAccessToken;
    }

    return requestNewAccessToken();
}

export function extractSpreadsheetId(input) {
    const trimmed = String(input || '').trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : trimmed;
}
