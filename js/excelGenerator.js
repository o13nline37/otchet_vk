import { getRubFormat } from './formatters.js';

export function normalizeExcelStyleSettings(settings = {}) {
    const allowedHorizontal = new Set(['left', 'center', 'right']);
    const allowedVertical = new Set(['top', 'middle', 'bottom']);
    const fontSize = Number(settings.fontSize) || 10;

    return {
        fontName: settings.fontName || 'Montserrat',
        fontSize: Math.min(Math.max(fontSize, 8), 24),
        horizontalAlign: allowedHorizontal.has(settings.horizontalAlign) ? settings.horizontalAlign : 'left',
        verticalAlign: allowedVertical.has(settings.verticalAlign) ? settings.verticalAlign : 'middle',
    };
}

function applyExcelStyleSettings(sheet, settings) {
    const style = normalizeExcelStyleSettings(settings);

    sheet.eachRow({ includeEmpty: false }, (row) => {
        if (row.font) {
            row.font = { ...row.font, name: style.fontName, size: style.fontSize };
        }

        if (row.alignment) {
            row.alignment = {
                ...row.alignment,
                horizontal: style.horizontalAlign,
                vertical: style.verticalAlign,
            };
        }

        row.eachCell({ includeEmpty: false }, (cell) => {
            cell.font = {
                ...(row.font || {}),
                ...(cell.font || {}),
                name: style.fontName,
                size: style.fontSize,
            };
            cell.alignment = {
                ...(cell.alignment || {}),
                horizontal: style.horizontalAlign,
                vertical: style.verticalAlign,
            };
        });
    });
}

function setRubValue(cell, value, format) {
    cell.value = value || 0;
    cell.numFmt = `${format};-${format};"-"`;
}

export function divisionFormula(numeratorRef, denominatorRef, multiplier) {
    const expression = multiplier && multiplier !== 1
        ? `${numeratorRef}/${denominatorRef}*${multiplier}`
        : `${numeratorRef}/${denominatorRef}`;
    return `IFERROR(${expression},0)`;
}

function applyHeaderStyle(row, values, colCount) {
    for (let i = 0; i < colCount; i++) {
        const cell = row.getCell(i + 1);
        cell.value = values[i];
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Montserrat', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF76A5AF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
}

function addMetricSection(sheet, startRow, title, items, rubFormat) {
    sheet.getCell(`A${startRow}`).value = title;
    sheet.getCell(`A${startRow}`).font = { bold: true, size: 12, name: 'Montserrat' };

    const headerRow = startRow + 1;
    const dataRow = startRow + 2;
    const headerValues = ['Метрика', ...items.map((item) => item.name)];
    const metrics = ['Расход', 'Показы', 'Клики', 'CTR', 'ВАЛ', 'CPL', 'ЦО', 'CPA'];

    applyHeaderStyle(sheet.getRow(headerRow), headerValues, headerValues.length);

    metrics.forEach((metric, index) => {
        const cell = sheet.getCell(dataRow + index, 1);
        cell.value = metric;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Montserrat', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF76A5AF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    items.forEach((item, index) => {
        const col = 2 + index;
        const ref = (row) => sheet.getCell(row, col).address;
        const impressionsRow = dataRow + 1;
        const clicksRow = dataRow + 2;
        const resultsRow = dataRow + 4;
        const coRow = dataRow + 6;

        setRubValue(sheet.getCell(dataRow, col), item.spent, rubFormat);
        sheet.getCell(impressionsRow, col).value = Math.round(item.impressions);
        sheet.getCell(impressionsRow, col).numFmt = '#,##0';
        sheet.getCell(clicksRow, col).value = Math.round(item.clicks);
        sheet.getCell(clicksRow, col).numFmt = '#,##0';

        sheet.getCell(dataRow + 3, col).value = { formula: divisionFormula(ref(clicksRow), ref(impressionsRow), 100) };
        sheet.getCell(dataRow + 3, col).numFmt = '0.00"%"';

        sheet.getCell(resultsRow, col).value = Math.round(item.results);
        sheet.getCell(resultsRow, col).numFmt = '#,##0';
        setRubValue(sheet.getCell(dataRow + 5, col), { formula: divisionFormula(ref(dataRow), ref(resultsRow)) }, rubFormat);
        sheet.getCell(coRow, col).value = item.co || 0;
        sheet.getCell(coRow, col).numFmt = '#,##0';
        setRubValue(sheet.getCell(dataRow + 7, col), { formula: divisionFormula(ref(dataRow), ref(coRow)) }, rubFormat);
    });

    for (let row = dataRow; row < dataRow + 8; row++) {
        for (let col = 2; col <= items.length + 1; col++) {
            sheet.getCell(row, col).alignment = { horizontal: 'right', vertical: 'middle' };
        }
    }

    for (let i = 2; i <= items.length + 1; i++) {
        sheet.getColumn(i).width = 18;
    }
}

function addTargetingsSection(sheet, startRow, targetings, rubFormat) {
    sheet.getCell(`A${startRow}`).value = 'Статистика по таргетингам';
    sheet.getCell(`A${startRow}`).font = { bold: true, size: 12, name: 'Montserrat' };

    const headerRow = startRow + 1;
    const dataRow = startRow + 2;
    const headers = ['Аудитория', 'Расход', 'Показы', 'Клики', 'CTR (%)', 'CPC', 'CPM', 'ВАЛ', 'CPL', 'ЦО', 'CPA'];

    applyHeaderStyle(sheet.getRow(headerRow), headers, headers.length);
    sheet.getRow(headerRow).height = 25;

    targetings.forEach((targeting, index) => {
        const row = dataRow + index;
        const ref = (col) => sheet.getCell(row, col).address;

        sheet.getCell(row, 1).value = targeting.name;
        setRubValue(sheet.getCell(row, 2), targeting.spent, rubFormat);
        sheet.getCell(row, 3).value = Math.round(targeting.impressions);
        sheet.getCell(row, 3).numFmt = '#,##0';
        sheet.getCell(row, 4).value = Math.round(targeting.clicks);
        sheet.getCell(row, 4).numFmt = '#,##0';

        sheet.getCell(row, 5).value = { formula: divisionFormula(ref(4), ref(3), 100) };
        sheet.getCell(row, 5).numFmt = '0.00"%"';

        setRubValue(sheet.getCell(row, 6), { formula: divisionFormula(ref(2), ref(4)) }, rubFormat);
        setRubValue(sheet.getCell(row, 7), { formula: divisionFormula(ref(2), ref(3), 1000) }, rubFormat);

        sheet.getCell(row, 8).value = Math.round(targeting.results);
        sheet.getCell(row, 8).numFmt = '#,##0';
        setRubValue(sheet.getCell(row, 9), { formula: divisionFormula(ref(2), ref(8)) }, rubFormat);
        sheet.getCell(row, 10).value = targeting.co || 0;
        sheet.getCell(row, 10).numFmt = '#,##0';
        setRubValue(sheet.getCell(row, 11), { formula: divisionFormula(ref(2), ref(10)) }, rubFormat);
        sheet.getRow(row).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const totalRowIndex = dataRow + targetings.length;
    const totalSpent = targetings.reduce((sum, targeting) => sum + (targeting.spent || 0), 0);
    const totalImpressions = targetings.reduce((sum, targeting) => sum + (targeting.impressions || 0), 0);
    const totalClicks = targetings.reduce((sum, targeting) => sum + (targeting.clicks || 0), 0);
    const totalResults = targetings.reduce((sum, targeting) => sum + (targeting.results || 0), 0);
    const totalCO = targetings.reduce((sum, targeting) => sum + (targeting.co || 0), 0);
    const totalRow = sheet.getRow(totalRowIndex);
    const totalRef = (col) => sheet.getCell(totalRowIndex, col).address;

    totalRow.font = { bold: true };
    totalRow.alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.height = 20;
    totalRow.getCell(1).value = 'Итого:';
    setRubValue(totalRow.getCell(2), totalSpent, rubFormat);
    totalRow.getCell(3).value = Math.round(totalImpressions);
    totalRow.getCell(3).numFmt = '#,##0';
    totalRow.getCell(4).value = Math.round(totalClicks);
    totalRow.getCell(4).numFmt = '#,##0';

    totalRow.getCell(5).value = { formula: divisionFormula(totalRef(4), totalRef(3), 100) };
    totalRow.getCell(5).numFmt = '0.00"%"';

    setRubValue(totalRow.getCell(6), { formula: divisionFormula(totalRef(2), totalRef(4)) }, rubFormat);
    setRubValue(totalRow.getCell(7), { formula: divisionFormula(totalRef(2), totalRef(3), 1000) }, rubFormat);

    totalRow.getCell(8).value = Math.round(totalResults);
    totalRow.getCell(8).numFmt = '#,##0';
    setRubValue(totalRow.getCell(9), { formula: divisionFormula(totalRef(2), totalRef(8)) }, rubFormat);
    totalRow.getCell(10).value = totalCO;
    totalRow.getCell(10).numFmt = '#,##0';
    setRubValue(totalRow.getCell(11), { formula: divisionFormula(totalRef(2), totalRef(10)) }, rubFormat);

    for (let i = 2; i <= 11; i++) {
        sheet.getColumn(i).width = 18;
    }
}

export async function generateExcelReport(data, excelStyleSettings = {}) {
    const workbook = new window.ExcelJS.Workbook();
    const sheetName = data.period ? `${data.title} | ${data.period}`.substring(0, 31) : data.title.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);
    const rubFormat = getRubFormat();

    sheet.properties.defaultRowHeight = 15;
    sheet.getCell('A1').value = 'Общая статистика';
    sheet.getCell('A1').font = { bold: true, size: 12, name: 'Montserrat' };
    sheet.getCell('A1').alignment = { horizontal: 'left' };

    const header = ['Расход', 'Показы', 'Клики', 'CTR (%)', 'CPC', 'CPM', 'ВАЛ', 'CPL', 'ЦО', 'CPA'];
    const headerRow = sheet.getRow(2);
    applyHeaderStyle(headerRow, header, 10);
    headerRow.height = 25;

    const valuesRow = sheet.getRow(3);

    valuesRow.alignment = { horizontal: 'right', vertical: 'middle' };
    valuesRow.height = 20;
    setRubValue(sheet.getCell('A3'), data.totalSpent, rubFormat);
    sheet.getCell('B3').value = Math.round(data.totalImpressions);
    sheet.getCell('B3').numFmt = '#,##0';
    sheet.getCell('C3').value = Math.round(data.totalClicks);
    sheet.getCell('C3').numFmt = '#,##0';

    sheet.getCell('D3').value = { formula: divisionFormula('C3', 'B3', 100) };
    sheet.getCell('D3').numFmt = '0.00"%"';

    setRubValue(sheet.getCell('E3'), { formula: divisionFormula('A3', 'C3') }, rubFormat);
    setRubValue(sheet.getCell('F3'), { formula: divisionFormula('A3', 'B3', 1000) }, rubFormat);

    sheet.getCell('G3').value = Math.round(data.totalResults);
    sheet.getCell('G3').numFmt = '#,##0';
    setRubValue(sheet.getCell('H3'), { formula: divisionFormula('A3', 'G3') }, rubFormat);
    sheet.getCell('I3').value = data.totalCO;
    sheet.getCell('I3').numFmt = '#,##0';
    setRubValue(sheet.getCell('J3'), { formula: divisionFormula('A3', 'I3') }, rubFormat);
    sheet.getColumn(1).width = 20;

    for (let i = 2; i <= 11; i++) {
        sheet.getColumn(i).width = 18;
    }

    if (data.creatives.length > 0) {
        addMetricSection(sheet, 5, 'Статистика по креативам', data.creatives, rubFormat);
    }

    if (data.adTexts.length > 0) {
        const startRow = data.creatives.length > 0 ? 16 : 5;
        addMetricSection(sheet, startRow, 'Статистика по текстам', data.adTexts, rubFormat);
    }

    if (data.targetings.length > 0) {
        const previousSectionsHeight = (data.creatives.length > 0 ? 12 : 0) + (data.adTexts.length > 0 ? 11 : 0);
        addTargetingsSection(sheet, 5 + previousSectionsHeight, data.targetings, rubFormat);
    }

    applyExcelStyleSettings(sheet, excelStyleSettings);

    return await workbook.xlsx.writeBuffer();
}
