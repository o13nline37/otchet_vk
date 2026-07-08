// Гейт входа через Google. Показывает экран входа поверх приложения и пускает
// внутрь только после успешной серверной проверки (whitelist 108 Media).
//
// Поток:
//   1. При загрузке проверяем сохранённую сессию (GET /api/auth/me).
//   2. Нет/просрочена -> показываем кнопку входа.
//   3. По клику запрашиваем у Google access token СРАЗУ с двумя scope — профиль
//      и Google Таблицы (см. GOOGLE_SHEETS_SCOPE) — одним окном согласия.
//   4. Токен шлём на бэкенд (POST /api/auth/google) для проверки и whitelist.
//   5. Бэкенд возвращает наш сессионный токен -> сохраняем и запускаем приложение.
//   6. Этот же access token кладём в кэш js/googleAuth.js, поэтому при экспорте
//      в Google Таблицу повторный запрос доступа уже не показывается.
import { GOOGLE_CLIENT_ID, GOOGLE_SHEETS_SCOPE } from './config.js';
import { getStoredToken, storeToken, clearToken, authFetch } from './apiClient.js';
import { setCachedAccessToken } from './googleAuth.js';
import { initApp } from './app.js';

const LOGIN_SCOPE = `openid email profile ${GOOGLE_SHEETS_SCOPE}`;

let appStarted = false;
let tokenClient = null;

// Ждём загрузки асинхронного скрипта Google Identity Services.
function waitForGoogle(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
            if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
            if (Date.now() - started > timeoutMs) {
                return reject(new Error('Не удалось загрузить Google Sign-In. Проверьте интернет и обновите страницу.'));
            }
            setTimeout(tick, 100);
        };
        tick();
    });
}

// --- Управление экранами ---

function showGate() {
    document.getElementById('auth-gate').hidden = false;
    document.querySelector('.app-shell').hidden = true;
}

function showApp(user) {
    document.getElementById('auth-gate').hidden = true;
    const shell = document.querySelector('.app-shell');
    shell.hidden = false;

    renderUserBadge(user);

    if (!appStarted) {
        appStarted = true;
        initApp();
    }
}

function renderUserBadge(user) {
    const nameEl = document.getElementById('auth-user-name');
    if (nameEl) nameEl.textContent = user?.email || '';
}

function setGateStatus(message, type = 'info') {
    const status = document.getElementById('auth-gate-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = `auth-gate-status ${message ? type : ''}`.trim();
}

function setGateBusy(isBusy) {
    document.getElementById('auth-gate')?.classList.toggle('is-busy', isBusy);
    const button = document.getElementById('google-signin-button');
    if (button) button.disabled = isBusy;
}

// --- Обращения к бэкенду ---

async function fetchCurrentUser() {
    const response = await authFetch('/api/auth/me');
    if (!response.ok) return null;
    const data = await response.json();
    return data.user;
}

async function exchangeGoogleAccessToken(accessToken) {
    const response = await authFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Не удалось войти. Попробуйте ещё раз.');
    }
    return data;
}

// --- Обработчик ответа Google ---

async function handleTokenResponse(response) {
    if (response.error) {
        setGateBusy(false);
        setGateStatus(`⚠️ Не удалось войти через Google: ${response.error}`, 'error');
        return;
    }

    setGateStatus('🔐 Проверяем доступ…', 'info');

    try {
        const { token, user } = await exchangeGoogleAccessToken(response.access_token);
        storeToken(token);
        // Тот же токен уже покрывает scope Google Таблиц — переиспользуем его,
        // чтобы при экспорте отчёта не запрашивать доступ повторно.
        setCachedAccessToken(response.access_token, response.expires_in);
        setGateStatus('', 'info');
        showApp(user);
    } catch (error) {
        setGateStatus(error.message, 'error');
    } finally {
        setGateBusy(false);
    }
}

async function initTokenClient() {
    let oauth2;
    try {
        oauth2 = await waitForGoogle();
    } catch (error) {
        setGateStatus(error.message, 'error');
        return null;
    }

    return oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: LOGIN_SCOPE,
        callback: handleTokenResponse,
        error_callback: (error) => {
            setGateBusy(false);
            setGateStatus(`⚠️ Не удалось открыть окно входа Google: ${error?.type || error}`, 'error');
        },
    });
}

async function handleSignInClick() {
    setGateBusy(true);
    setGateStatus('', 'info');

    if (!tokenClient) {
        tokenClient = await initTokenClient();
    }
    if (!tokenClient) {
        setGateBusy(false);
        return;
    }

    tokenClient.requestAccessToken();
}

// --- Выход ---

function handleLogout() {
    clearToken();
    renderUserBadge(null);
    showGate();
    setGateStatus('Вы вышли из аккаунта.', 'info');
}

// --- Точка входа ---

export async function bootstrapAuth() {
    document.getElementById('auth-logout')?.addEventListener('click', handleLogout);
    document.getElementById('google-signin-button')?.addEventListener('click', handleSignInClick);

    const token = getStoredToken();
    if (token) {
        // Пытаемся продолжить сохранённую сессию без повторного входа.
        try {
            const user = await fetchCurrentUser();
            if (user) {
                showApp(user);
                return;
            }
        } catch {
            // Сеть недоступна или сессия невалидна — падаем на экран входа ниже.
        }
        clearToken();
    }

    showGate();
}

document.addEventListener('DOMContentLoaded', bootstrapAuth);
