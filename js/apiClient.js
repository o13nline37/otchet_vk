// Общая обёртка для обращений к бэкенду: хранение сессионного токена и fetch с
// подставленным адресом API и заголовком авторизации. Используется js/authGate.js
// и js/userSettings.js, чтобы не дублировать работу с localStorage в двух местах.
import { API_BASE_URL } from './config.js';

const SESSION_TOKEN_KEY = 'otchet_vk_session_token';

export function getStoredToken() {
    return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function storeToken(token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(SESSION_TOKEN_KEY);
}

// fetch к бэкенду с уже подставленным адресом и заголовком Authorization (если есть сессия).
export function authFetch(path, options = {}) {
    const token = getStoredToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
