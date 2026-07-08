// Значения по умолчанию и нормализация настроек — зеркалит ограничения полей формы
// на фронтенде (см. index.html и js/excelGenerator.js), чтобы в БД не попал мусор.
const ALLOWED_FONTS = new Set(['Montserrat', 'Arial', 'Calibri', 'Times New Roman', 'Verdana']);
const ALLOWED_HORIZONTAL = new Set(['left', 'center', 'right']);
const ALLOWED_VERTICAL = new Set(['top', 'middle', 'bottom']);
const ALLOWED_NUMBER_FORMAT = new Set(['integer', 'decimal']);
const ALLOWED_OUTPUT_FORMAT = new Set(['xlsx', 'gsheet']);

export const DEFAULT_SETTINGS = {
    vat: 1.22,
    ak1: 1,
    ak2: 1,
    ak3: 1,
    fontName: 'Montserrat',
    fontSize: 10,
    horizontalAlign: 'center',
    verticalAlign: 'middle',
    numberFormat: 'integer',
    outputFormat: 'xlsx',
};

function clampMultiplier(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return fallback;
    return Math.min(num, 5);
}

export function normalizeSettings(input = {}) {
    return {
        vat: clampMultiplier(input.vat, DEFAULT_SETTINGS.vat),
        ak1: clampMultiplier(input.ak1, DEFAULT_SETTINGS.ak1),
        ak2: clampMultiplier(input.ak2, DEFAULT_SETTINGS.ak2),
        ak3: clampMultiplier(input.ak3, DEFAULT_SETTINGS.ak3),
        fontName: ALLOWED_FONTS.has(input.fontName) ? input.fontName : DEFAULT_SETTINGS.fontName,
        fontSize: Math.min(Math.max(Number(input.fontSize) || DEFAULT_SETTINGS.fontSize, 8), 24),
        horizontalAlign: ALLOWED_HORIZONTAL.has(input.horizontalAlign) ? input.horizontalAlign : DEFAULT_SETTINGS.horizontalAlign,
        verticalAlign: ALLOWED_VERTICAL.has(input.verticalAlign) ? input.verticalAlign : DEFAULT_SETTINGS.verticalAlign,
        numberFormat: ALLOWED_NUMBER_FORMAT.has(input.numberFormat) ? input.numberFormat : DEFAULT_SETTINGS.numberFormat,
        outputFormat: ALLOWED_OUTPUT_FORMAT.has(input.outputFormat) ? input.outputFormat : DEFAULT_SETTINGS.outputFormat,
    };
}
