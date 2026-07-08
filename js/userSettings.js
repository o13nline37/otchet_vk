// Личные настройки пользователя (множители, стиль Excel, формат вывода):
// подставляются в форму при входе и обновляются на сервере при каждой генерации отчёта.
import { authFetch } from './apiClient.js';

const SETTINGS_ENDPOINT = '/api/settings';

const FIELD_IDS = {
    vat: 'vk-vat',
    ak1: 'vk-ak1',
    ak2: 'vk-ak2',
    ak3: 'vk-ak3',
    fontName: 'xlsx-font',
    fontSize: 'xlsx-font-size',
    horizontalAlign: 'xlsx-horizontal-align',
    verticalAlign: 'xlsx-vertical-align',
};

function applySettings(settings) {
    Object.entries(FIELD_IDS).forEach(([key, id]) => {
        const field = document.getElementById(id);
        if (field && settings[key] !== undefined && settings[key] !== null) {
            field.value = settings[key];
        }
    });

    // Кнопки формата чисел и переключатель вывода реагируют на события, а не просто
    // на значение поля — переиспользуем уже привязанные в ui.js обработчики.
    const formatButtonId = settings.numberFormat === 'decimal' ? 'fmt-decimal' : 'fmt-integer';
    document.getElementById(formatButtonId)?.click();

    if (settings.outputFormat === 'gsheet') {
        const gsheetRadio = document.getElementById('output-gsheet');
        if (gsheetRadio) {
            gsheetRadio.checked = true;
            gsheetRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

// Подтягивает сохранённые настройки пользователя и подставляет их в форму.
// Вызывать после bindUiEvents() — иначе её дефолты перезапишут применённые значения.
// Ошибка сети/сервера не должна ломать работу с формой — просто останутся дефолты.
export async function applyStoredSettings() {
    try {
        const response = await authFetch(SETTINGS_ENDPOINT);
        if (!response.ok) return;
        const { settings } = await response.json();
        if (settings) applySettings(settings);
    } catch {
        // нет сети или бэкенд недоступен — работаем со значениями по умолчанию
    }
}

// Сохраняет текущие значения формы как настройки пользователя по умолчанию.
// Не блокирует генерацию отчёта — ошибка сохранения тихо игнорируется.
export function saveCurrentSettings(reportConfig, excelStyleSettings, outputFormat) {
    const numberFormat = document.getElementById('fmt-decimal')?.classList.contains('active')
        ? 'decimal'
        : 'integer';

    const body = {
        vat: reportConfig.vat,
        ak1: reportConfig.ak1,
        ak2: reportConfig.ak2,
        ak3: reportConfig.ak3,
        ...excelStyleSettings,
        numberFormat,
        outputFormat,
    };

    authFetch(SETTINGS_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // Запрос не блокирует генерацию отчёта (fire-and-forget), а keepalive не даёт
        // браузеру оборвать его, если пользователь успеет обновить страницу раньше,
        // чем придёт ответ — иначе новые значения не долетали бы до сервера.
        keepalive: true,
    }).catch(() => {});
}
