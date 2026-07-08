// Проверка, что email относится к сотруднику 108 Media (whitelist по домену или точечный email).
import { config } from '../config.js';

// Возвращает true, если email допущен к сервису.
export function isEmailAllowed(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return false;

    // Точечный whitelist имеет приоритет и работает даже вне разрешённых доменов.
    if (config.allowedEmails.includes(normalized)) return true;

    const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
    return config.allowedEmailDomains.includes(domain);
}
