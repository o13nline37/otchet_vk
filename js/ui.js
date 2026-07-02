import { setNumberFormat } from './formatters.js';

const FILE_NOT_SELECTED_TEXT = 'Файл не выбран';

function toggleHint(button) {
    const element = document.getElementById(button.dataset.hintTarget);
    if (!element) return;

    element.classList.toggle('visible');
    button.classList.toggle('is-open', element.classList.contains('visible'));
}

function setFormat(format) {
    setNumberFormat(format);
    document.getElementById('fmt-integer').classList.toggle('active', format === 'integer');
    document.getElementById('fmt-decimal').classList.toggle('active', format === 'decimal');
}

function resetUploadState(inputId, labelId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const uploadItem = input.closest('.upload-item');

    input.value = '';
    label.textContent = FILE_NOT_SELECTED_TEXT;
    uploadItem?.classList.remove('has-file');
}

function clearForm() {
    document.getElementById('vk-title').value = '';
    document.getElementById('vk-date-from').value = '';
    document.getElementById('vk-date-to').value = '';
    document.getElementById('vk-vat').value = '1.22';
    document.getElementById('vk-ak1').value = '1';
    document.getElementById('vk-ak2').value = '1';
    document.getElementById('vk-ak3').value = '1';
    document.getElementById('vk-phones').value = '';
    document.getElementById('xlsx-font').value = 'Montserrat';
    document.getElementById('xlsx-font-size').value = '10';
    document.getElementById('xlsx-horizontal-align').value = 'left';
    document.getElementById('xlsx-vertical-align').value = 'middle';

    resetUploadState('vk-ads', 'ads-name');
    resetUploadState('vk-groups', 'groups-name');
    resetUploadState('vk-temp', 'temp-name');

    document.querySelectorAll('.help-hint').forEach((hint) => hint.classList.remove('visible'));
    document.querySelectorAll('.help-btn').forEach((button) => button.classList.remove('is-open'));
    setFormat('integer');
    showNotification('🧹 Данные очищены', 'info');
}

function bindFileName(inputId, labelId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const uploadItem = input.closest('.upload-item');

    input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        label.textContent = file ? `✅ ${file.name}` : FILE_NOT_SELECTED_TEXT;
        uploadItem?.classList.toggle('has-file', Boolean(file));
    });
}

export function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

export function bindUiEvents() {
    document.querySelectorAll('[data-hint-target]').forEach((button) => {
        button.addEventListener('click', () => toggleHint(button));
    });

    document.querySelectorAll('[data-format]').forEach((button) => {
        button.addEventListener('click', () => setFormat(button.dataset.format));
    });

    document.getElementById('fmt-clear').addEventListener('click', clearForm);

    bindFileName('vk-ads', 'ads-name');
    bindFileName('vk-groups', 'groups-name');
    bindFileName('vk-temp', 'temp-name');
    setFormat('integer');
}
