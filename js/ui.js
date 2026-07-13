import { setNumberFormat } from './formatters.js';
import { loadSavedSpreadsheets } from './savedSpreadsheets.js';
import {
    addVKFiles,
    getVKFileKey,
    getVKUploadState,
    removeVKFile as removeStoredVKFile,
    resetVKUploadState as resetStoredVKUploadState,
} from './vkFileStore.js';

const PROJECTS_DATA_URL = 'data/projects.json';
const MAX_SUGGESTIONS = 7;
const VK_FILE_TYPE_META = {
    ads: { label: 'Объявления', name: 'объявления', genitive: 'объявлений', icon: '📣' },
    groups: { label: 'Группы', name: 'группы', genitive: 'групп', icon: '👥' },
    leads: { label: 'Лиды', name: 'лиды', genitive: 'лидов', icon: '☎️' },
};

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
// showAllOnEmpty — показывать весь список при фокусе на пустое поле (режим "выбрать
// из недавних"), иначе подсказки появляются только при начале ввода (режим поиска).
// refreshOnFocus — перезапрашивать loadItems при каждом фокусе, а не один раз при
// загрузке страницы — нужно, если список может пополниться в течение той же сессии.
function bindAutocomplete({ inputId, suggestionsId, loadItems, getText, onSelect, showAllOnEmpty = false, refreshOnFocus = false }) {
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
        visibleMatches = query.trim()
            ? getMatches(items, query, getText)
            : (showAllOnEmpty ? items.slice(0, MAX_SUGGESTIONS) : []);
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
        if (refreshOnFocus) {
            loadItems().then((loadedItems) => {
                items = loadedItems;
                renderSuggestions();
            });
            return;
        }

        if (input.value.trim() || showAllOnEmpty) renderSuggestions();
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
        showAllOnEmpty: true,
        refreshOnFocus: true,
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

    resetVKUploadState();

    document.getElementById('project-suggestions')?.classList.remove('visible');
    document.getElementById('project-suggestions')?.replaceChildren();
    document.getElementById('spreadsheet-suggestions')?.classList.remove('visible');
    document.getElementById('spreadsheet-suggestions')?.replaceChildren();
    document.querySelectorAll('.help-hint').forEach((hint) => hint.classList.remove('visible'));
    document.querySelectorAll('.help-btn').forEach((button) => button.classList.remove('is-open'));
    setFormat('integer');
    showNotification('🧹 Данные очищены', 'info');
}

function formatRussianList(items) {
    if (items.length < 2) return items[0] || '';
    return `${items.slice(0, -1).join(', ')} и ${items.at(-1)}`;
}

function createRemoveFileButton(type, file) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vk-upload-remove';
    button.dataset.vkRemoveType = type;
    button.dataset.vkFileKey = getVKFileKey(file);
    button.setAttribute('aria-label', `Удалить файл ${file.name}`);
    button.title = `Удалить ${file.name}`;
    button.textContent = 'Удалить';
    return button;
}

function createRecognizedFileItem(type, file) {
    const item = document.createElement('div');
    item.className = 'vk-upload-file';

    const status = document.createElement('span');
    status.className = 'vk-upload-file-check';
    status.textContent = '✅';
    status.setAttribute('aria-label', 'Файл распознан');

    const name = document.createElement('span');
    name.className = 'vk-upload-file-name';
    name.textContent = file.name;
    name.title = file.name;

    item.append(status, name, createRemoveFileButton(type, file));
    return item;
}

function getUnknownFileMessage(entry) {
    if (entry.reason === 'ambiguous') {
        const types = entry.matches.map((type) => VK_FILE_TYPE_META[type].genitive);
        return `Файл одновременно похож на выгрузку ${formatRussianList(types)}`;
    }
    return 'Не удалось определить тип файла';
}

function createUnknownFileItem(entry) {
    const item = document.createElement('div');
    item.className = 'vk-upload-file vk-upload-file--unknown';

    const name = document.createElement('span');
    name.className = 'vk-upload-file-name';
    name.textContent = entry.file.name;
    name.title = entry.file.name;

    const reason = document.createElement('span');
    reason.className = 'vk-upload-file-reason';
    reason.textContent = getUnknownFileMessage(entry);

    item.append(name, reason, createRemoveFileButton('unknown', entry.file));
    return item;
}

export function renderVKUploadState() {
    const state = getVKUploadState();
    const statusList = document.getElementById('vk-upload-status-list');
    const unknownBox = document.getElementById('vk-upload-unknown');
    const unknownList = document.getElementById('vk-upload-unknown-list');
    const uploadBox = document.getElementById('vk-upload-box');
    const progress = document.getElementById('vk-upload-progress');
    const complete = document.getElementById('vk-upload-complete');
    if (!statusList || !unknownBox || !unknownList || !uploadBox || !progress || !complete) return;

    statusList.replaceChildren();
    Object.entries(VK_FILE_TYPE_META).forEach(([type, meta]) => {
        const files = type === 'leads' ? state.leads : (state[type] ? [state[type]] : []);
        const row = document.createElement('section');
        row.className = `vk-upload-status vk-upload-status--${type} ${files.length > 0 ? 'is-loaded' : 'is-empty'}`;

        const heading = document.createElement('div');
        heading.className = 'vk-upload-status-heading';

        const title = document.createElement('strong');
        title.textContent = `${meta.icon} ${meta.label}`;
        const count = document.createElement('span');
        count.textContent = files.length > 0
            ? (type === 'leads' ? `${files.length} файл(а)` : 'Файл распознан')
            : 'Файл не загружен';
        heading.append(title, count);
        row.appendChild(heading);

        if (files.length > 0) {
            const fileList = document.createElement('div');
            fileList.className = 'vk-upload-files';
            files.forEach((file) => fileList.appendChild(createRecognizedFileItem(type, file)));
            row.appendChild(fileList);
        }

        statusList.appendChild(row);
    });

    unknownList.replaceChildren(...state.unknown.map(createUnknownFileItem));
    unknownBox.hidden = state.unknown.length === 0;

    const loadedTypeCount = Number(Boolean(state.ads)) + Number(Boolean(state.groups)) + Number(state.leads.length > 0);
    const allRequiredFilesLoaded = loadedTypeCount === 3;
    progress.textContent = `Загружено ${loadedTypeCount} из 3 типов выгрузок`;
    progress.classList.toggle('is-complete', allRequiredFilesLoaded);
    complete.hidden = !allRequiredFilesLoaded;
    uploadBox.classList.toggle('has-files', loadedTypeCount > 0);
    uploadBox.classList.toggle('has-errors', state.unknown.length > 0);
}

function getIssueNotification(issue) {
    if (issue.code === 'unsupported') {
        return `Поддерживаются только .xlsx, .xls и .csv: ${issue.file.name}`;
    }
    if (issue.code === 'duplicate') {
        return `Файл уже добавлен: ${issue.file.name}`;
    }
    if (issue.code === 'occupied') {
        return `Файл с таким типом уже загружен: ${issue.file.name}`;
    }
    if (issue.code === 'ambiguous') {
        const types = issue.matches.map((type) => VK_FILE_TYPE_META[type].genitive);
        return `Файл одновременно похож на выгрузку ${formatRussianList(types)}: ${issue.file.name}`;
    }
    return `Не удалось определить тип файла: ${issue.file.name}`;
}

function showVKAddResult(result) {
    const addedTypes = Array.from(new Set(result.added.map(({ type }) => type)));

    if (result.issues.length > 0) {
        const issueText = result.issues.map(getIssueNotification).join(' · ');
        const recognizedText = addedTypes.length > 0
            ? ` Распознаны: ${formatRussianList(addedTypes.map((type) => VK_FILE_TYPE_META[type].name))}.`
            : '';
        showNotification(`⚠️ ${issueText}.${recognizedText}`, 'error');
        return;
    }

    if (result.added.length === 1) {
        const [{ file, type }] = result.added;
        showNotification(`✅ Загружена выгрузка ${VK_FILE_TYPE_META[type].genitive}: ${file.name}`, 'success');
        return;
    }

    if (addedTypes.length > 0) {
        showNotification(`✅ Распознаны файлы: ${formatRussianList(addedTypes.map((type) => VK_FILE_TYPE_META[type].name))}`, 'success');
    }
}

function handleVKFiles(files) {
    const result = addVKFiles(files);
    renderVKUploadState();
    showVKAddResult(result);
}

export function removeVKFile(type, fileKey) {
    const removed = removeStoredVKFile(type, fileKey);
    if (removed) renderVKUploadState();
    return removed;
}

export function resetVKUploadState() {
    resetStoredVKUploadState();
    const input = document.getElementById('vk-files');
    if (input) input.value = '';
    document.getElementById('vk-upload-dropzone')?.classList.remove('is-dragover');
    renderVKUploadState();
}

function bindVKFilePicker() {
    const input = document.getElementById('vk-files');
    const dropzone = document.getElementById('vk-upload-dropzone');
    const statusList = document.getElementById('vk-upload-status-list');
    const unknownList = document.getElementById('vk-upload-unknown-list');
    if (!input || !dropzone || !statusList || !unknownList) return;

    dropzone.addEventListener('click', (event) => {
        if (event.target === input) return;
        input.click();
    });
    dropzone.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        input.click();
    });

    input.addEventListener('change', (event) => {
        handleVKFiles(event.target.files);
        event.target.value = '';
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'dragend'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.remove('is-dragover');
        });
    });

    dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove('is-dragover');
        handleVKFiles(event.dataTransfer.files);
    });

    const handleRemoveClick = (event) => {
        const button = event.target.closest('[data-vk-remove-type][data-vk-file-key]');
        if (!button) return;
        removeVKFile(button.dataset.vkRemoveType, button.dataset.vkFileKey);
    };
    statusList.addEventListener('click', handleRemoveClick);
    unknownList.addEventListener('click', handleRemoveClick);

    renderVKUploadState();
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
    clearTimeout(notification._hideTimer);
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    notification._hideTimer = setTimeout(() => {
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

    bindProjectAutocomplete();
    bindSpreadsheetAutocomplete();
    bindVKFilePicker();
    bindOutputFormatToggle();
    setFormat('integer');
}
