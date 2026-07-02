import { generateExcelReport } from './excelGenerator.js';
import { downloadFile, readExcelFile } from './fileReader.js';
import { processVKReport } from './reportProcessor.js';
import { bindUiEvents, showNotification } from './ui.js';

function getTargetPhones() {
    const phonesText = document.getElementById('vk-phones').value;
    if (!phonesText || !phonesText.trim()) return [];

    return phonesText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function getReportConfig() {
    const title = document.getElementById('vk-title').value.trim();
    const dateFrom = document.getElementById('vk-date-from').value;
    const dateTo = document.getElementById('vk-date-to').value;
    const vat = parseFloat(document.getElementById('vk-vat').value) || 1.22;
    const ak1 = parseFloat(document.getElementById('vk-ak1').value) || 1;
    const ak2 = parseFloat(document.getElementById('vk-ak2').value) || 1;
    const ak3 = parseFloat(document.getElementById('vk-ak3').value) || 1;
    const period = dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : '';

    return {
        title,
        period,
        vat,
        ak1,
        ak2,
        ak3,
        ak: ak1 * ak2 * ak3,
    };
}

function getExcelStyleSettings() {
    const fontSize = parseInt(document.getElementById('xlsx-font-size').value, 10) || 10;

    return {
        fontName: document.getElementById('xlsx-font').value,
        fontSize: Math.min(Math.max(fontSize, 8), 24),
        horizontalAlign: document.getElementById('xlsx-horizontal-align').value,
        verticalAlign: document.getElementById('xlsx-vertical-align').value,
    };
}

function normalizeHeader(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
}

function findColumnIndex(data, candidates, fallbackIndex) {
    const header = data && data[0] ? data[0] : [];
    const normalizedCandidates = candidates.map(normalizeHeader);

    for (let i = 0; i < header.length; i++) {
        const columnName = normalizeHeader(header[i]);
        if (normalizedCandidates.some((candidate) => columnName.includes(candidate))) return i;
    }

    return fallbackIndex;
}

const LEAD_COLUMNS = [
    'ID Кампании',
    'ID Группы',
    'ID Объявления',
    'Время лида',
    'Имя',
    'Телефон',
    'Комментарий',
];

function normalizeLeadTable(table) {
    if (!table || table.length <= 1) return [];

    const columnMap = [
        findColumnIndex(table, ['id кампании', 'campaign id'], 0),
        findColumnIndex(table, ['id группы', 'group id'], 1),
        findColumnIndex(table, ['id объявления', 'id обьявления', 'ad id'], 2),
        findColumnIndex(table, ['время лида', 'дата', 'created'], 3),
        findColumnIndex(table, ['имя', 'name'], 4),
        findColumnIndex(table, ['телефон', 'phone'], 5),
        findColumnIndex(table, ['комментарий', 'comment'], 6),
    ];

    return table.slice(1)
        .filter((row) => row && row.some((cell) => cell !== ''))
        .map((row) => columnMap.map((columnIndex) => row[columnIndex] ?? ''));
}

export function mergeLeadTables(tables) {
    if (!tables.length) return [];

    const rows = [];

    tables.forEach((table) => {
        rows.push(...normalizeLeadTable(table));
    });

    return rows.length > 0 ? [LEAD_COLUMNS, ...rows] : [];
}

function validateForm(config, adsFile, groupsFile) {
    if (!config.title) {
        showNotification('📌 Укажите название проекта', 'error');
        return false;
    }

    if (!adsFile || !groupsFile) {
        showNotification('📎 Загрузите файлы Объявления и Группы', 'error');
        return false;
    }

    if (config.vat > 5 || config.ak1 > 5 || config.ak2 > 5 || config.ak3 > 5) {
        throw new Error('⚠️ Некорректное значение НДС или АК');
    }

    return true;
}

async function handleSubmit(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    const config = getReportConfig();
    const adsFile = document.getElementById('vk-ads').files[0];
    const groupsFile = document.getElementById('vk-groups').files[0];
    const tempFiles = Array.from(document.getElementById('vk-temp').files);

    try {
        if (!validateForm(config, adsFile, groupsFile)) return;

        submitButton.disabled = true;
        submitButton.textContent = '⏳ Собираю отчет...';

        showNotification('📚 Чтение файлов...', 'info');
        const adsData = await readExcelFile(adsFile);
        const groupsData = await readExcelFile(groupsFile);
        const tempData = mergeLeadTables(await Promise.all(tempFiles.map(readExcelFile)));

        showNotification('🧮 Обработка данных...', 'info');
        const reportData = processVKReport(adsData, groupsData, tempData, getTargetPhones(), config);

        showNotification('✨ Генерация отчета...', 'info');
        const excelData = await generateExcelReport(reportData, getExcelStyleSettings());
        const filename = config.period
            ? `${config.title}_${config.period.replace(/\s/g, '_')}.xlsx`
            : `${config.title}.xlsx`;

        downloadFile(excelData, filename);
        showNotification('✅ Отчет создан! ЦО=' + reportData.totalCO, 'success');
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '✨ Создать отчет';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    bindUiEvents();
    document.getElementById('vk-form').addEventListener('submit', handleSubmit);
});
