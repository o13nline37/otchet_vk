import { getRubFormat } from './formatters.js';
import { normalizeExcelStyleSettings } from './excelGenerator.js';
import { ensureAccessToken } from './googleAuth.js';
import { rememberSpreadsheet } from './savedSpreadsheets.js';

// Google Sheets парсит формулы, записанные через API, в синтаксисе локали самой
// таблицы: для ru-локали нужны русские имена функций (ЕСЛИОШИБКА вместо IFERROR)
// и точка с запятой вместо запятой между аргументами (запятая — десятичный разделитель).
function divisionFormula(numeratorRef, denominatorRef, multiplier, locale) {
    const isRussianLocale = String(locale || '').toLowerCase().startsWith('ru');
    const fnName = isRussianLocale ? 'ЕСЛИОШИБКА' : 'IFERROR';
    const argSeparator = isRussianLocale ? ';' : ',';
    const expression = multiplier && multiplier !== 1
        ? `${numeratorRef}/${denominatorRef}*${multiplier}`
        : `${numeratorRef}/${denominatorRef}`;

    return `${fnName}(${expression}${argSeparator}0)`;
}

const HEADER_FILL = 'FF76A5AF';
const HEADER_TEXT_COLOR = 'FFFFFFFF';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const ALIGN_MAP = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', top: 'TOP', middle: 'MIDDLE', bottom: 'BOTTOM' };

class SheetsGrid {
    constructor() {
        this.cells = new Map();
        this.columnWidths = new Map();
    }

    cell(row, col) {
        const key = `${row}:${col}`;
        if (!this.cells.has(key)) this.cells.set(key, {});
        return this.cells.get(key);
    }

    setColumnWidth(col, width) {
        this.columnWidths.set(col, width);
    }
}

function columnLetter(col) {
    let letter = '';
    let n = col;

    while (n > 0) {
        const remainder = (n - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        n = Math.floor((n - 1) / 26);
    }

    return letter;
}

function cellAddress(row, col) {
    return `${columnLetter(col)}${row}`;
}

function hexToRgb01(argbOrRgbHex) {
    const clean = String(argbOrRgbHex).replace('#', '');
    const rgbHex = clean.length === 8 ? clean.slice(2) : clean;

    return {
        red: parseInt(rgbHex.substring(0, 2), 16) / 255,
        green: parseInt(rgbHex.substring(2, 4), 16) / 255,
        blue: parseInt(rgbHex.substring(4, 6), 16) / 255,
    };
}

function setCellValue(grid, row, col, value) {
    const cell = grid.cell(row, col);

    if (value && typeof value === 'object' && 'formula' in value) {
        cell.userEnteredValue = { formulaValue: `=${value.formula}` };
    } else if (typeof value === 'number') {
        cell.userEnteredValue = { numberValue: value };
    } else {
        cell.userEnteredValue = { stringValue: String(value) };
    }
}

function setCellNumberFormat(grid, row, col, pattern) {
    const cell = grid.cell(row, col);
    cell.userEnteredFormat = cell.userEnteredFormat || {};
    cell.userEnteredFormat.numberFormat = { type: 'NUMBER', pattern };
}

function setCellStyle(grid, row, col, { bold, size, color, fill, halign, valign } = {}) {
    const cell = grid.cell(row, col);
    cell.userEnteredFormat = cell.userEnteredFormat || {};

    if (bold !== undefined || color || size) {
        cell.userEnteredFormat.textFormat = {
            ...(cell.userEnteredFormat.textFormat || {}),
            ...(bold !== undefined ? { bold } : {}),
            ...(color ? { foregroundColor: hexToRgb01(color) } : {}),
            ...(size ? { fontSize: size } : {}),
        };
    }

    if (fill) cell.userEnteredFormat.backgroundColor = hexToRgb01(fill);
    if (halign) cell.userEnteredFormat.horizontalAlignment = ALIGN_MAP[halign] || halign;
    if (valign) cell.userEnteredFormat.verticalAlignment = ALIGN_MAP[valign] || valign;
}

function setRubCell(grid, row, col, value, rubFormat) {
    setCellValue(grid, row, col, typeof value === 'object' ? value : (value || 0));
    setCellNumberFormat(grid, row, col, `${rubFormat};-${rubFormat};"-"`);
}

function buildGeneralStatsCells(grid, data, rubFormat, locale) {
    setCellValue(grid, 1, 1, 'Общая статистика');
    setCellStyle(grid, 1, 1, { bold: true, size: 12 });

    const header = ['Расход', 'Показы', 'Клики', 'CTR (%)', 'CPC', 'CPM', 'ВАЛ', 'CPL', 'ЦО', 'CPA'];
    header.forEach((value, index) => {
        const col = index + 1;
        setCellValue(grid, 2, col, value);
        setCellStyle(grid, 2, col, { bold: true, color: HEADER_TEXT_COLOR, fill: HEADER_FILL, halign: 'center', valign: 'middle' });
    });

    setRubCell(grid, 3, 1, data.totalSpent, rubFormat);
    setCellValue(grid, 3, 2, Math.round(data.totalImpressions));
    setCellNumberFormat(grid, 3, 2, '#,##0');
    setCellValue(grid, 3, 3, Math.round(data.totalClicks));
    setCellNumberFormat(grid, 3, 3, '#,##0');

    setCellValue(grid, 3, 4, { formula: divisionFormula('C3', 'B3', 100, locale) });
    setCellNumberFormat(grid, 3, 4, '0.00"%"');

    setRubCell(grid, 3, 5, { formula: divisionFormula('A3', 'C3', 1, locale) }, rubFormat);
    setRubCell(grid, 3, 6, { formula: divisionFormula('A3', 'B3', 1000, locale) }, rubFormat);

    setCellValue(grid, 3, 7, Math.round(data.totalResults));
    setCellNumberFormat(grid, 3, 7, '#,##0');
    setRubCell(grid, 3, 8, { formula: divisionFormula('A3', 'G3', 1, locale) }, rubFormat);
    setCellValue(grid, 3, 9, data.totalCO);
    setCellNumberFormat(grid, 3, 9, '#,##0');
    setRubCell(grid, 3, 10, { formula: divisionFormula('A3', 'I3', 1, locale) }, rubFormat);

    for (let col = 1; col <= 10; col++) {
        setCellStyle(grid, 3, col, { halign: 'right', valign: 'middle' });
    }

    grid.setColumnWidth(1, 150);
    for (let i = 2; i <= 10; i++) grid.setColumnWidth(i, 130);
}

function buildMetricSectionCells(grid, startRow, title, items, rubFormat, locale) {
    setCellValue(grid, startRow, 1, title);
    setCellStyle(grid, startRow, 1, { bold: true, size: 12 });

    const headerRow = startRow + 1;
    const dataRow = startRow + 2;
    const headerValues = ['Метрика', ...items.map((item) => item.name)];
    const metrics = ['Расход', 'Показы', 'Клики', 'CTR', 'ВАЛ', 'CPL', 'ЦО', 'CPA'];

    headerValues.forEach((value, index) => {
        const col = index + 1;
        setCellValue(grid, headerRow, col, value);
        setCellStyle(grid, headerRow, col, { bold: true, color: HEADER_TEXT_COLOR, fill: HEADER_FILL, halign: 'center', valign: 'middle' });
    });

    metrics.forEach((metric, index) => {
        const row = dataRow + index;
        setCellValue(grid, row, 1, metric);
        setCellStyle(grid, row, 1, { bold: true, color: HEADER_TEXT_COLOR, fill: HEADER_FILL, halign: 'center', valign: 'middle' });
    });

    items.forEach((item, index) => {
        const col = 2 + index;
        const ref = (row) => cellAddress(row, col);
        const impressionsRow = dataRow + 1;
        const clicksRow = dataRow + 2;
        const resultsRow = dataRow + 4;
        const coRow = dataRow + 6;

        setRubCell(grid, dataRow, col, item.spent, rubFormat);
        setCellValue(grid, impressionsRow, col, Math.round(item.impressions));
        setCellNumberFormat(grid, impressionsRow, col, '#,##0');
        setCellValue(grid, clicksRow, col, Math.round(item.clicks));
        setCellNumberFormat(grid, clicksRow, col, '#,##0');

        setCellValue(grid, dataRow + 3, col, { formula: divisionFormula(ref(clicksRow), ref(impressionsRow), 100, locale) });
        setCellNumberFormat(grid, dataRow + 3, col, '0.00"%"');

        setCellValue(grid, resultsRow, col, Math.round(item.results));
        setCellNumberFormat(grid, resultsRow, col, '#,##0');
        setRubCell(grid, dataRow + 5, col, { formula: divisionFormula(ref(dataRow), ref(resultsRow), 1, locale) }, rubFormat);
        setCellValue(grid, coRow, col, item.co || 0);
        setCellNumberFormat(grid, coRow, col, '#,##0');
        setRubCell(grid, dataRow + 7, col, { formula: divisionFormula(ref(dataRow), ref(coRow), 1, locale) }, rubFormat);
    });

    for (let row = dataRow; row < dataRow + 8; row++) {
        for (let col = 2; col <= items.length + 1; col++) {
            setCellStyle(grid, row, col, { halign: 'right', valign: 'middle' });
        }
    }

    for (let i = 2; i <= items.length + 1; i++) grid.setColumnWidth(i, 130);
}

function buildTargetingsSectionCells(grid, startRow, targetings, rubFormat, locale) {
    setCellValue(grid, startRow, 1, 'Статистика по таргетингам');
    setCellStyle(grid, startRow, 1, { bold: true, size: 12 });

    const headerRow = startRow + 1;
    const dataRow = startRow + 2;
    const headers = ['Аудитория', 'Расход', 'Показы', 'Клики', 'CTR (%)', 'CPC', 'CPM', 'ВАЛ', 'CPL', 'ЦО', 'CPA'];

    headers.forEach((value, index) => {
        const col = index + 1;
        setCellValue(grid, headerRow, col, value);
        setCellStyle(grid, headerRow, col, { bold: true, color: HEADER_TEXT_COLOR, fill: HEADER_FILL, halign: 'center', valign: 'middle' });
    });

    targetings.forEach((targeting, index) => {
        const row = dataRow + index;
        const ref = (col) => cellAddress(row, col);

        setCellValue(grid, row, 1, targeting.name);
        setRubCell(grid, row, 2, targeting.spent, rubFormat);
        setCellValue(grid, row, 3, Math.round(targeting.impressions));
        setCellNumberFormat(grid, row, 3, '#,##0');
        setCellValue(grid, row, 4, Math.round(targeting.clicks));
        setCellNumberFormat(grid, row, 4, '#,##0');

        setCellValue(grid, row, 5, { formula: divisionFormula(ref(4), ref(3), 100, locale) });
        setCellNumberFormat(grid, row, 5, '0.00"%"');

        setRubCell(grid, row, 6, { formula: divisionFormula(ref(2), ref(4), 1, locale) }, rubFormat);
        setRubCell(grid, row, 7, { formula: divisionFormula(ref(2), ref(3), 1000, locale) }, rubFormat);

        setCellValue(grid, row, 8, Math.round(targeting.results));
        setCellNumberFormat(grid, row, 8, '#,##0');
        setRubCell(grid, row, 9, { formula: divisionFormula(ref(2), ref(8), 1, locale) }, rubFormat);
        setCellValue(grid, row, 10, targeting.co || 0);
        setCellNumberFormat(grid, row, 10, '#,##0');
        setRubCell(grid, row, 11, { formula: divisionFormula(ref(2), ref(10), 1, locale) }, rubFormat);

        for (let col = 1; col <= 11; col++) {
            setCellStyle(grid, row, col, { halign: 'right', valign: 'middle' });
        }
    });

    const totalRowIndex = dataRow + targetings.length;
    const totalSpent = targetings.reduce((sum, t) => sum + (t.spent || 0), 0);
    const totalImpressions = targetings.reduce((sum, t) => sum + (t.impressions || 0), 0);
    const totalClicks = targetings.reduce((sum, t) => sum + (t.clicks || 0), 0);
    const totalResults = targetings.reduce((sum, t) => sum + (t.results || 0), 0);
    const totalCO = targetings.reduce((sum, t) => sum + (t.co || 0), 0);
    const totalRef = (col) => cellAddress(totalRowIndex, col);

    setCellValue(grid, totalRowIndex, 1, 'Итого:');
    setRubCell(grid, totalRowIndex, 2, totalSpent, rubFormat);
    setCellValue(grid, totalRowIndex, 3, Math.round(totalImpressions));
    setCellNumberFormat(grid, totalRowIndex, 3, '#,##0');
    setCellValue(grid, totalRowIndex, 4, Math.round(totalClicks));
    setCellNumberFormat(grid, totalRowIndex, 4, '#,##0');

    setCellValue(grid, totalRowIndex, 5, { formula: divisionFormula(totalRef(4), totalRef(3), 100, locale) });
    setCellNumberFormat(grid, totalRowIndex, 5, '0.00"%"');

    setRubCell(grid, totalRowIndex, 6, { formula: divisionFormula(totalRef(2), totalRef(4), 1, locale) }, rubFormat);
    setRubCell(grid, totalRowIndex, 7, { formula: divisionFormula(totalRef(2), totalRef(3), 1000, locale) }, rubFormat);

    setCellValue(grid, totalRowIndex, 8, Math.round(totalResults));
    setCellNumberFormat(grid, totalRowIndex, 8, '#,##0');
    setRubCell(grid, totalRowIndex, 9, { formula: divisionFormula(totalRef(2), totalRef(8), 1, locale) }, rubFormat);
    setCellValue(grid, totalRowIndex, 10, totalCO);
    setCellNumberFormat(grid, totalRowIndex, 10, '#,##0');
    setRubCell(grid, totalRowIndex, 11, { formula: divisionFormula(totalRef(2), totalRef(10), 1, locale) }, rubFormat);

    for (let col = 1; col <= 11; col++) {
        setCellStyle(grid, totalRowIndex, col, { bold: true, halign: 'right', valign: 'middle' });
    }

    for (let i = 2; i <= 11; i++) grid.setColumnWidth(i, 130);
}

function applyGlobalStyleSettings(grid, styleSettings) {
    const style = normalizeExcelStyleSettings(styleSettings);
    const halign = ALIGN_MAP[style.horizontalAlign] || 'LEFT';
    const valign = ALIGN_MAP[style.verticalAlign] || 'MIDDLE';

    for (const cell of grid.cells.values()) {
        cell.userEnteredFormat = cell.userEnteredFormat || {};
        cell.userEnteredFormat.textFormat = {
            ...(cell.userEnteredFormat.textFormat || {}),
            fontFamily: style.fontName,
            fontSize: style.fontSize,
        };
        cell.userEnteredFormat.horizontalAlignment = halign;
        cell.userEnteredFormat.verticalAlignment = valign;
    }
}

function buildReportGrid(data, excelStyleSettings, locale) {
    const grid = new SheetsGrid();
    const rubFormat = getRubFormat();

    buildGeneralStatsCells(grid, data, rubFormat, locale);

    if (data.creatives.length > 0) {
        buildMetricSectionCells(grid, 5, 'Статистика по креативам', data.creatives, rubFormat, locale);
    }

    if (data.adTexts.length > 0) {
        const startRow = data.creatives.length > 0 ? 16 : 5;
        buildMetricSectionCells(grid, startRow, 'Статистика по текстам', data.adTexts, rubFormat, locale);
    }

    if (data.targetings.length > 0) {
        const previousSectionsHeight = (data.creatives.length > 0 ? 12 : 0) + (data.adTexts.length > 0 ? 11 : 0);
        buildTargetingsSectionCells(grid, 5 + previousSectionsHeight, data.targetings, rubFormat, locale);
    }

    applyGlobalStyleSettings(grid, excelStyleSettings);

    return grid;
}

// Название таблицы запрашивается тем же вызовом, что и локаль — лишнего похода
// к Google не требуется, только заодно тянем поле properties.title.
async function fetchSpreadsheetMeta(accessToken, spreadsheetId) {
    const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.locale,properties.title`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return { locale: '', title: '' };

    const body = await response.json().catch(() => null);
    return {
        locale: body?.properties?.locale || '',
        title: body?.properties?.title || '',
    };
}

function gridToRequests(grid, sheetId) {
    let maxRow = 0;
    let maxCol = 0;

    for (const key of grid.cells.keys()) {
        const [row, col] = key.split(':').map(Number);
        if (row > maxRow) maxRow = row;
        if (col > maxCol) maxCol = col;
    }

    const rows = [];
    for (let row = 1; row <= maxRow; row++) {
        const values = [];
        for (let col = 1; col <= maxCol; col++) {
            values.push(grid.cells.get(`${row}:${col}`) || {});
        }
        rows.push({ values });
    }

    const requests = [{
        updateCells: {
            rows,
            fields: 'userEnteredValue,userEnteredFormat',
            start: { sheetId, rowIndex: 0, columnIndex: 0 },
        },
    }];

    for (const [col, width] of grid.columnWidths.entries()) {
        requests.push({
            updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: col - 1, endIndex: col },
                properties: { pixelSize: width },
                fields: 'pixelSize',
            },
        });
    }

    return requests;
}

async function sheetsBatchUpdate(accessToken, spreadsheetId, requests) {
    const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error?.message || response.statusText;

        if (response.status === 403 || response.status === 404) {
            throw new Error(`⚠️ Нет доступа к этой Google-таблице. Проверьте ссылку/ID и права редактирования: ${message}`);
        }

        throw new Error(`⚠️ Google Sheets API: ${message}`);
    }

    return response.json();
}

function buildSheetTitle(data) {
    const raw = data.period ? `${data.title} | ${data.period}` : data.title;
    return raw.slice(0, 100);
}

export async function exportReportToGoogleSheet(spreadsheetId, data, excelStyleSettings) {
    const accessToken = await ensureAccessToken();
    const { locale, title: spreadsheetTitle } = await fetchSpreadsheetMeta(accessToken, spreadsheetId);
    const grid = buildReportGrid(data, excelStyleSettings, locale);
    const sheetId = Math.floor(Math.random() * 900000000) + 100000000;
    const title = buildSheetTitle(data);

    const requests = [
        { addSheet: { properties: { sheetId, title } } },
        ...gridToRequests(grid, sheetId),
    ];

    await sheetsBatchUpdate(accessToken, spreadsheetId, requests);

    // Не блокирует уже готовый результат — таблица запоминается для автодополнения
    // в фоне, ошибка сохранения не должна выглядеть как ошибка экспорта.
    rememberSpreadsheet(spreadsheetId, spreadsheetTitle);

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;
}
