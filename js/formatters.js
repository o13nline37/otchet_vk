let numberFormat = 'integer';

export function setNumberFormat(format) {
    numberFormat = format;
}

export function getRubFormat() {
    return numberFormat === 'integer' ? '#,##0 "руб."' : '#,##0.00 "руб."';
}

export function findVideoCreative(name) {
    const patterns = [/видео[\s_]?(\d+)/i, /video[\s_]?(\d+)/i, /vid[\s_]?(\d+)/i, /[vв](\d+)_/i];

    for (const pattern of patterns) {
        const match = name.match(pattern);
        if (match && match[1] >= 1 && match[1] <= 10) return "Видеокреатив " + match[1];
    }

    return null;
}

export function extractNumber(name) {
    const match = name.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
}

export function sortCreatives(items) {
    return items.slice().sort((a, b) => {
        const aIsVideo = a.name.startsWith('Видеокреатив');
        const bIsVideo = b.name.startsWith('Видеокреатив');
        if (aIsVideo !== bIsVideo) return aIsVideo ? 1 : -1;
        return extractNumber(a.name) - extractNumber(b.name);
    });
}

export function sortTexts(items) {
    return items.slice().sort((a, b) => extractNumber(a.name) - extractNumber(b.name));
}
