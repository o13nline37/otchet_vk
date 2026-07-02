import { setNumberFormat } from './formatters.js';

const FILE_NOT_SELECTED_TEXT = 'Файл не выбран';
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

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

function renderFileNames(label, files) {
    label.replaceChildren();

    if (files.length === 0) {
        label.textContent = FILE_NOT_SELECTED_TEXT;
        return;
    }

    files.forEach((file) => {
        const item = document.createElement('span');
        item.className = 'file-name-item';
        item.textContent = `✅ ${file.name}`;
        label.appendChild(item);
    });
}

function resetUploadState(inputId, labelId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const uploadItem = input.closest('.upload-item');

    input._selectedFiles = [];
    input.value = '';
    renderFileNames(label, []);
    uploadItem?.classList.remove('has-file');
}

function isAcceptedFile(file) {
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function getDroppedFiles(dataTransfer, allowMultiple) {
    const files = Array.from(dataTransfer.files || []).filter(isAcceptedFile);
    return allowMultiple ? files : files.slice(0, 1);
}

function getFileKey(file) {
    return `${file.name}::${file.size}::${file.lastModified}`;
}

function mergeFiles(currentFiles, newFiles, allowMultiple) {
    if (!allowMultiple) return newFiles.slice(0, 1);

    const knownFiles = new Set(currentFiles.map(getFileKey));
    const mergedFiles = currentFiles.slice();

    newFiles.forEach((file) => {
        const key = getFileKey(file);
        if (!knownFiles.has(key)) {
            knownFiles.add(key);
            mergedFiles.push(file);
        }
    });

    return mergedFiles;
}

function syncInputFiles(input, files, shouldDispatchChange = false) {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;

    if (shouldDispatchChange) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
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

function bindFilePicker(inputId, labelId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const wrapper = input.closest('.file-input-wrapper');
    const uploadItem = input.closest('.upload-item');
    input._selectedFiles = [];

    wrapper.addEventListener('click', (event) => {
        if (event.target === input) return;
        input.click();
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        wrapper.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            wrapper.classList.add('is-dragover');
        });
    });

    ['dragleave', 'dragend'].forEach((eventName) => {
        wrapper.addEventListener(eventName, () => {
            wrapper.classList.remove('is-dragover');
        });
    });

    wrapper.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        wrapper.classList.remove('is-dragover');

        const files = getDroppedFiles(event.dataTransfer, input.multiple);
        if (files.length === 0) {
            showNotification('📎 Поддерживаются только .xlsx, .xls и .csv', 'error');
            return;
        }

        input._selectedFiles = mergeFiles(input._selectedFiles || [], files, input.multiple);
        syncInputFiles(input, input._selectedFiles, true);
    });

    input.addEventListener('change', (event) => {
        const files = mergeFiles(input._selectedFiles || [], Array.from(event.target.files), input.multiple);

        input._selectedFiles = files;
        syncInputFiles(input, files);
        renderFileNames(label, input._selectedFiles);
        uploadItem?.classList.toggle('has-file', files.length > 0);
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

    bindFilePicker('vk-ads', 'ads-name');
    bindFilePicker('vk-groups', 'groups-name');
    bindFilePicker('vk-temp', 'temp-name');
    setFormat('integer');
}
