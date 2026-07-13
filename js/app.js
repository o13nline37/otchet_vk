import { generateExcelReport } from './excelGenerator.js';
import { downloadFile, readExcelFile } from './fileReader.js';
import { processVKReport } from './reportProcessor.js';
import { bindUiEvents, getOutputFormat, getGoogleSheetInput, showNotification } from './ui.js';
import { getVKUploadedFiles } from './vkFileStore.js';
import { extractSpreadsheetId } from './googleAuth.js';
import { exportReportToGoogleSheet } from './sheetsReportBuilder.js';
import { applyStoredSettings, saveCurrentSettings } from './userSettings.js';

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

function validateForm(config, uploadedFiles, outputFormat, spreadsheetId) {
    if (!config.title) {
        showNotification('📌 Укажите название проекта', 'error');
        return false;
    }

    const missingFiles = [];
    if (!uploadedFiles.adsFile) missingFiles.push('📎 Не загружена выгрузка объявлений');
    if (!uploadedFiles.groupsFile) missingFiles.push('📎 Не загружена выгрузка групп');
    if (uploadedFiles.leadFiles.length === 0) missingFiles.push('📎 Не загружена выгрузка лидов');
    if (uploadedFiles.unresolvedFiles.length > 0) {
        missingFiles.push('⚠️ Удалите файлы с неизвестным или неоднозначным типом');
    }

    if (missingFiles.length > 0) {
        showNotification(missingFiles.join(' · '), 'error');
        return false;
    }

    if (outputFormat === 'gsheet' && !spreadsheetId) {
        showNotification('🔗 Вставьте ссылку или ID Google-таблицы', 'error');
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
    const uploadedFiles = getVKUploadedFiles();
    const { adsFile, groupsFile, leadFiles } = uploadedFiles;
    const outputFormat = getOutputFormat();
    const spreadsheetId = outputFormat === 'gsheet' ? extractSpreadsheetId(getGoogleSheetInput()) : '';

    try {
        if (!validateForm(config, uploadedFiles, outputFormat, spreadsheetId)) return;

        const excelStyleSettings = getExcelStyleSettings();
        // Значения уже прошли валидацию — сохраняем их как настройки по умолчанию
        // на будущее, не дожидаясь результата генерации отчёта.
        saveCurrentSettings(config, excelStyleSettings, outputFormat);

        submitButton.disabled = true;
        submitButton.textContent = '⏳ Собираю отчет...';

        showNotification('📚 Чтение файлов...', 'info');
        const adsData = await readExcelFile(adsFile);
        const groupsData = await readExcelFile(groupsFile);
        const tempData = await Promise.all(leadFiles.map(readExcelFile));

        showNotification('🧮 Обработка данных...', 'info');
        const reportData = processVKReport(adsData, groupsData, tempData, getTargetPhones(), config);

        if (outputFormat === 'gsheet') {
            showNotification('🔐 Ожидаю авторизацию Google...', 'info');
            const sheetUrl = await exportReportToGoogleSheet(spreadsheetId, reportData, excelStyleSettings);

            showNotification('✅ Лист добавлен в Google-таблицу! ЦО=' + reportData.totalCO, 'success');
            window.open(sheetUrl, '_blank', 'noopener');
        } else {
            showNotification('✨ Генерация отчета...', 'info');
            const excelData = await generateExcelReport(reportData, excelStyleSettings);
            const filename = config.period
                ? `${config.title}_${config.period.replace(/\s/g, '_')}.xlsx`
                : `${config.title}.xlsx`;

            downloadFile(excelData, filename);
            showNotification('✅ Отчет создан! ЦО=' + reportData.totalCO, 'success');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '✨ Создать отчет';
    }
}

// Инициализация приложения. Вызывается из js/authGate.js только после успешного входа,
// поэтому здесь нет самозапуска на DOMContentLoaded.
export function initApp() {
    bindUiEvents();
    document.getElementById('vk-form').addEventListener('submit', handleSubmit);
    // После bindUiEvents(), которая проставляет дефолты формы — иначе они перезапишут
    // подставленные сохранённые значения.
    applyStoredSettings();
}
