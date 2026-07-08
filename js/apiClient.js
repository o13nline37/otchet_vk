// Общая обёртка для обращений к бэкенду: хранение сессионного токена и fetch с
// подставленным адресом API и заголовком авторизации. Используется js/authGate.js
// и js/userSettings.js, чтобы не дублировать работу с localStorage в двух местах.
import { API_BASE_URL } from './config.js';

const SESSION_TOKEN_KEY = 'otchet_vk_session_token';
// Бесплатный бэкенд на Render засыпает после простоя и может отвечать до ~50 сек
// на пробуждении — тайм-аут больше этого, чтобы не обрывать легитимно долгий запрос,
// но конечный, чтобы запрос не подвисал бесконечно при реальном сетевом сбое.
const DEFAULT_TIMEOUT_MS = 60000;

export function getStoredToken() {
    return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function storeToken(token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(SESSION_TOKEN_KEY);
}

// fetch к бэкенду с уже подставленным адресом, заголовком Authorization (если есть
// сессия) и тайм-аутом — без него подвисший запрос (например, если бэкенд/база не
// отвечают) блокировал бы UI бесконечно, без единого способа выйти из этого состояния.
export function authFetch(path, { timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
    const token = getStoredToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal })
        .catch((error) => {
            if (error.name === 'AbortError') {
                throw new Error('⚠️ Сервер долго не отвечает (возможно, ещё «просыпается» после простоя). Попробуйте ещё раз через немного.');
            }
            throw error;
        })
        .finally(() => clearTimeout(timeoutId));
}
