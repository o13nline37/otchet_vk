import { setNumberFormat } from './formatters.js';
import { loadSavedSpreadsheets } from './savedSpreadsheets.js';

const FILE_NOT_SELECTED_TEXT = 'Файл не выбран';
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const PROJECTS_DATA_URL = 'data/projects.json';
const MAX_SUGGESTIONS = 7;

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
        item.title = file.name;
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

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
}

function scoreMatch(text, query) {
    const normalizedText = normalizeSearchText(text);
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return -1;
    if (normalizedText === normalizedQuery) return 1000;
    if (normalizedText.startsWith(normalizedQuery)) return 800 - normalizedText.length;

    const wordStartIndex = normalizedText.indexOf(' ' + normalizedQuery);
    if (wordStartIndex !== -1) return 650 - wordStartIndex;

    const includesIndex = normalizedText.indexOf(normalizedQuery);
    if (includesIndex !== -1) return 500 - includesIndex;

    let queryIndex = 0;
    for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
        if (normalizedText[i] === normalizedQuery[queryIndex]) queryIndex++;
    }

    return queryIndex === normalizedQuery.length ? 220 - normalizedText.length : -1;
}

// getText достаёт из элемента списка ту строку, по которой ищем и которую показываем
// (для проектов элемент — сама строка, для таблиц — объект {title, spreadsheetId}).
function getMatches(items, query, getText) {
    return items
        .map((item) => ({ item, score: scoreMatch(getText(item), query) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score || getText(a.item).localeCompare(getText(b.item), 'ru'))
        .slice(0, MAX_SUGGESTIONS)
        .map((entry) => entry.item);
}

function appendHighlightedText(element, text, query) {
    const normalizedText = normalizeSearchText(text);
    const normalizedQuery = normalizeSearchText(query);
    const matchIndex = normalizedQuery ? normalizedText.indexOf(normalizedQuery) : -1;

    if (matchIndex === -1) {
        element.textContent = text;
        return;
    }

    element.append(document.createTextNode(text.slice(0, matchIndex)));

    const mark = document.createElement('mark');
    mark.textContent = text.slice(matchIndex, matchIndex + query.length);
    element.append(mark, document.createTextNode(text.slice(matchIndex + query.length)));
}

async function loadProjectNames() {
    try {
        const response = await fetch(PROJECTS_DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Не удалось загрузить ${PROJECTS_DATA_URL}`);

        const data = await response.json();
        const projects = Array.isArray(data) ? data : data.projects;
        return Array.from(new Set((projects || []).map((name) => String(name).trim()).filter(Boolean)));
    } catch (error) {
        console.warn(error);
        return [];
    }
}

// Общий движок автодополнения: поиск с подсветкой, клавиатурная навигация, клик
// вне поля закрывает список. loadItems подгружает данные асинхронно (файл или API),
// getText достаёт отображаемую/сравниваемую строку, onSelect решает, что подставить
// в поле при выборе (для проектов — сама строка, для таблиц — их ID).
function bindAutocomplete({ inputId, suggestionsId, loadItems, getText, onSelect }) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    if (!input || !suggestions) return;

    let items = [];
    let visibleMatches = [];
    let activeIndex = -1;

    const hideSuggestions = () => {
        suggestions.classList.remove('visible');
        suggestions.replaceChildren();
        input.setAttribute('aria-expanded', 'false');
        activeIndex = -1;
        visibleMatches = [];
    };

    const selectItem = (item) => {
        onSelect(input, item);
        hideSuggestions();
        input.focus();
    };

    const renderSuggestions = () => {
        const query = input.value;
        visibleMatches = getMatches(items, query, getText);
        suggestions.replaceChildren();

        if (visibleMatches.length === 0) {
            hideSuggestions();
            return;
        }

        activeIndex = 0;
        visibleMatches.forEach((item, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'autocomplete-suggestion';
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');

            const text = document.createElement('span');
            text.className = 'autocomplete-suggestion-text';
            appendHighlightedText(text, getText(item), query);
            option.appendChild(text);

            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => selectItem(item));
            suggestions.appendChild(option);
        });

        suggestions.classList.add('visible');
        input.setAttribute('aria-expanded', 'true');
        updateActiveSuggestion();
    };

    const updateActiveSuggestion = () => {
        Array.from(suggestions.children).forEach((option, index) => {
            const isActive = index === activeIndex;
            option.classList.toggle('is-active', isActive);
            option.setAttribute('aria-selected', isActive ? 'true' : 'false');
            if (isActive) option.scrollIntoView({ block: 'nearest' });
        });
    };

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', () => {
        if (input.value.trim()) renderSuggestions();
    });
    input.addEventListener('keydown', (event) => {
        if (!suggestions.classList.contains('visible')) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % visibleMatches.length;
            updateActiveSuggestion();
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            activeIndex = (activeIndex - 1 + visibleMatches.length) % visibleMatches.length;
            updateActiveSuggestion();
        }

        if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            selectItem(visibleMatches[activeIndex]);
        }

        if (event.key === 'Escape') {
            hideSuggestions();
        }
    });

    document.addEventListener('click', (event) => {
        if (!input.closest('.autocomplete-field')?.contains(event.target)) hideSuggestions();
    });

    loadItems().then((loadedItems) => {
        items = loadedItems;
    });
}

function bindProjectAutocomplete() {
    bindAutocomplete({
        inputId: 'vk-title',
        suggestionsId: 'project-suggestions',
        loadItems: loadProjectNames,
        getText: (name) => name,
        onSelect: (input, name) => { input.value = name; },
    });
}

function bindSpreadsheetAutocomplete() {
    bindAutocomplete({
        inputId: 'gsheet-url',
        suggestionsId: 'spreadsheet-suggestions',
        loadItems: loadSavedSpreadsheets,
        getText: (spreadsheet) => spreadsheet.title || spreadsheet.spreadsheetId,
        onSelect: (input, spreadsheet) => {
            input.value = `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`;
        },
    });
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
    document.getElementById('xlsx-horizontal-align').value = 'center';
    document.getElementById('xlsx-vertical-align').value = 'middle';
    document.getElementById('output-xlsx').checked = true;
    document.getElementById('gsheet-url').value = '';
    document.getElementById('gsheet-link-group').hidden = true;

    resetUploadState('vk-ads', 'ads-name');
    resetUploadState('vk-groups', 'groups-name');
    resetUploadState('vk-temp', 'temp-name');

    document.getElementById('project-suggestions')?.classList.remove('visible');
    document.getElementById('project-suggestions')?.replaceChildren();
    document.getElementById('spreadsheet-suggestions')?.classList.remove('visible');
    document.getElementById('spreadsheet-suggestions')?.replaceChildren();
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

function bindOutputFormatToggle() {
    const gsheetLinkGroup = document.getElementById('gsheet-link-group');
    const gsheetRadio = document.getElementById('output-gsheet');

    document.querySelectorAll('input[name="output-format"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            gsheetLinkGroup.hidden = !gsheetRadio.checked;
        });
    });
}

export function getOutputFormat() {
    return document.getElementById('output-gsheet').checked ? 'gsheet' : 'xlsx';
}

export function getGoogleSheetInput() {
    return document.getElementById('gsheet-url').value.trim();
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

export function getSelectedFiles(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return [];

    const selectedFiles = Array.from(input._selectedFiles || []);
    return selectedFiles.length > 0 ? selectedFiles : Array.from(input.files || []);
}

export function bindUiEvents() {
    document.querySelectorAll('[data-hint-target]').forEach((button) => {
        button.addEventListener('click', () => toggleHint(button));
    });

    document.querySelectorAll('[data-format]').forEach((button) => {
        button.addEventListener('click', () => setFormat(button.dataset.format));
    });

    document.getElementById('fmt-clear').addEventListener('click', clearForm);

    bindProjectAutocomplete();
    bindSpreadsheetAutocomplete();
    bindFilePicker('vk-ads', 'ads-name');
    bindFilePicker('vk-groups', 'groups-name');
    bindFilePicker('vk-temp', 'temp-name');
    bindOutputFormatToggle();
    setFormat('integer');
}
