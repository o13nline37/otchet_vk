const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const uploadedVKFiles = {
    ads: null,
    groups: null,
    leads: [],
    unknown: [],
};

const LATIN_KEYWORDS = {
    ads: ['banner', 'banners', 'ads'],
    groups: ['group', 'groups'],
    leads: ['lead', 'leads', 'temp'],
};

const CYRILLIC_KEYWORDS = {
    ads: ['баннер', 'объявлен'],
    groups: ['групп'],
    leads: ['лид'],
};

function normalizeFileStem(fileName) {
    const baseName = String(fileName || '').replace(/\\/g, '/').split('/').pop() || '';
    const extensionIndex = baseName.lastIndexOf('.');
    const stem = extensionIndex > 0 ? baseName.slice(0, extensionIndex) : baseName;
    return stem.normalize('NFC').toLocaleLowerCase('ru-RU');
}

function containsLatinKeyword(fileStem, keyword) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escapedKeyword}(?=$|[^a-z])`, 'u').test(fileStem);
}

function getMatchingVKFileTypes(fileName) {
    const fileStem = normalizeFileStem(fileName);

    return Object.keys(LATIN_KEYWORDS).filter((type) => {
        const matchesLatin = LATIN_KEYWORDS[type].some((keyword) => containsLatinKeyword(fileStem, keyword));
        const matchesCyrillic = CYRILLIC_KEYWORDS[type].some((keyword) => fileStem.includes(keyword));
        return matchesLatin || matchesCyrillic;
    });
}

function isAcceptedFile(file) {
    const fileName = String(file?.name || '').toLocaleLowerCase('ru-RU');
    return ACCEPTED_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function getStoredFiles() {
    return [
        uploadedVKFiles.ads,
        uploadedVKFiles.groups,
        ...uploadedVKFiles.leads,
        ...uploadedVKFiles.unknown.map((entry) => entry.file),
    ].filter(Boolean);
}

export function getVKFileKey(file) {
    return `${file.name}::${file.size}::${file.lastModified}`;
}

export function detectVKFileType(fileName) {
    const matches = getMatchingVKFileTypes(fileName);
    return matches.length === 1 ? matches[0] : 'unknown';
}

export function addVKFiles(files) {
    const result = { added: [], issues: [] };

    Array.from(files || []).forEach((file) => {
        if (!isAcceptedFile(file)) {
            result.issues.push({ code: 'unsupported', file });
            return;
        }

        const fileKey = getVKFileKey(file);
        const isDuplicate = getStoredFiles().some((storedFile) => getVKFileKey(storedFile) === fileKey);
        if (isDuplicate) {
            result.issues.push({ code: 'duplicate', file });
            return;
        }

        const matches = getMatchingVKFileTypes(file.name);
        if (matches.length !== 1) {
            uploadedVKFiles.unknown.push({
                file,
                fileKey,
                matches,
                reason: matches.length > 1 ? 'ambiguous' : 'unknown',
            });
            result.issues.push({
                code: matches.length > 1 ? 'ambiguous' : 'unknown',
                file,
                matches,
            });
            return;
        }

        const [type] = matches;
        if ((type === 'ads' || type === 'groups') && uploadedVKFiles[type]) {
            result.issues.push({ code: 'occupied', file, type });
            return;
        }

        if (type === 'leads') {
            uploadedVKFiles.leads.push(file);
        } else {
            uploadedVKFiles[type] = file;
        }
        result.added.push({ file, type });
    });

    return result;
}

export function removeVKFile(type, fileKey) {
    if (type === 'ads' || type === 'groups') {
        const file = uploadedVKFiles[type];
        if (!file || getVKFileKey(file) !== fileKey) return false;
        uploadedVKFiles[type] = null;
        return true;
    }

    if (type === 'leads') {
        const initialLength = uploadedVKFiles.leads.length;
        uploadedVKFiles.leads = uploadedVKFiles.leads.filter((file) => getVKFileKey(file) !== fileKey);
        return uploadedVKFiles.leads.length !== initialLength;
    }

    if (type === 'unknown') {
        const initialLength = uploadedVKFiles.unknown.length;
        uploadedVKFiles.unknown = uploadedVKFiles.unknown.filter((entry) => entry.fileKey !== fileKey);
        return uploadedVKFiles.unknown.length !== initialLength;
    }

    return false;
}

export function resetVKUploadState() {
    uploadedVKFiles.ads = null;
    uploadedVKFiles.groups = null;
    uploadedVKFiles.leads = [];
    uploadedVKFiles.unknown = [];
}

export function getVKUploadState() {
    return {
        ads: uploadedVKFiles.ads,
        groups: uploadedVKFiles.groups,
        leads: uploadedVKFiles.leads.slice(),
        unknown: uploadedVKFiles.unknown.map((entry) => ({ ...entry })),
    };
}

export function getVKUploadedFiles() {
    return {
        adsFile: uploadedVKFiles.ads,
        groupsFile: uploadedVKFiles.groups,
        leadFiles: uploadedVKFiles.leads.slice(),
        unresolvedFiles: uploadedVKFiles.unknown.map((entry) => ({ ...entry })),
    };
}
