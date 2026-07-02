import { findVideoCreative, sortCreatives, sortTexts } from './formatters.js';
import { clearPhoneCache, normalizePhoneCached } from './phoneUtils.js';

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

function normalizeId(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));

    return String(value)
        .replace(/\s+/g, '')
        .replace(/^["']|["']$/g, '')
        .replace(/\.0$/, '')
        .trim();
}

function findTargetingName(groupDict, groupId) {
    if (groupId && groupDict[groupId]) return groupDict[groupId];
    if (!groupId) return "";

    const numericGroupId = parseFloat(groupId);
    if (Number.isNaN(numericGroupId)) return "";

    for (const [dictId, dictName] of Object.entries(groupDict)) {
        if (parseFloat(dictId) === numericGroupId) return dictName;
    }

    return "";
}

function findCreativeName(adName) {
    const videoCreative = findVideoCreative(adName);
    if (videoCreative) return videoCreative;

    const match = adName.match(/[СCКK](\d{1,2}(?:\.\d+)?)/i);
    if (!match) return "";

    const number = match[1];
    const baseNumber = parseInt(number.split('.')[0], 10);
    return baseNumber >= 1 && baseNumber <= 99 ? "Креатив " + number : "";
}

function findTextName(adName) {
    const match = adName.match(/[_\sТT](\d{1,2}(?:\.\d+)?)/i);
    if (!match) return "";

    const number = match[1];
    const baseNumber = parseInt(number.split('.')[0], 10);
    return baseNumber >= 1 && baseNumber <= 99 ? "Текст " + number : "";
}

function buildGroupDictionary(groupsData) {
    const groupDict = {};

    if (!groupsData) return groupDict;

    for (let i = 1; i < groupsData.length; i++) {
        const row = groupsData[i];
        if (!row || row.length < 7) continue;

        const groupName = String(row[0] || "").trim();
        const groupId = normalizeId(row[6]);
        if (groupId && groupName) groupDict[groupId] = groupName;
    }

    return groupDict;
}

function buildCOByAdId(adsData, groupsData, tempData, targetPhonesFromInput) {
    clearPhoneCache();

    const targetPhones = new Set();
    if (targetPhonesFromInput && targetPhonesFromInput.length > 0) {
        for (let i = 0; i < targetPhonesFromInput.length; i++) {
            const phone = normalizePhoneCached(targetPhonesFromInput[i]);
            if (phone) targetPhones.add(phone);
        }
    }

    const shouldFilterByTargetPhones = targetPhones.size > 0;
    const adsAdIdIndex = findColumnIndex(adsData, ['id объявления', 'id обьявления', 'ad id'], 6);
    const leadsAdIdIndex = findColumnIndex(tempData, ['id объявления', 'id обьявления', 'ad id'], 2);
    const leadsPhoneIndex = findColumnIndex(tempData, ['телефон', 'phone'], 5);

    const callData = [];
    if (tempData && tempData.length > 1) {
        for (let i = 1; i < tempData.length; i++) {
            const row = tempData[i];
            if (!row) continue;

            const adId = normalizeId(row[leadsAdIdIndex]);
            const phone = normalizePhoneCached(row[leadsPhoneIndex]);
            callData.push([adId, phone]);
        }
    }

    const coByCallAdId = new Map();
    for (let i = 0; i < callData.length; i++) {
        const adId = callData[i][0];
        const phone = callData[i][1];

        if (adId && phone && (!shouldFilterByTargetPhones || targetPhones.has(phone))) {
            coByCallAdId.set(adId, (coByCallAdId.get(adId) || 0) + 1);
        }
    }

    const groupDict = buildGroupDictionary(groupsData);
    const mainData = [];

    if (adsData) {
        const adNameIndex = findColumnIndex(adsData, ['название', 'name'], 0);
        const adGroupIdIndex = findColumnIndex(adsData, ['id группы', 'group id'], 7);

        for (let i = 1; i < adsData.length; i++) {
            const row = adsData[i];
            if (!row || row.length < 8) continue;

            const adId = normalizeId(row[adsAdIdIndex]);
            const adName = String(row[adNameIndex] || "").trim();
            const groupId = normalizeId(row[adGroupIdIndex]);
            const targeting = findTargetingName(groupDict, groupId);
            const creative = findCreativeName(adName);
            const text = findTextName(adName);
            mainData.push([adId, adName, targeting, creative, text]);
        }
    }

    const coByCreative = new Map();
    const coByTargeting = new Map();
    const coByAdText = new Map();
    let totalCO = 0;

    for (let i = 0; i < mainData.length; i++) {
        const adId = normalizeId(mainData[i][0]);
        if (!adId || !coByCallAdId.has(adId)) continue;

        const count = coByCallAdId.get(adId);
        const targeting = String(mainData[i][2] || "").trim();
        const creative = String(mainData[i][3] || "").trim();
        const adText = String(mainData[i][4] || "").trim();

        totalCO += count;
        if (creative) coByCreative.set(creative, (coByCreative.get(creative) || 0) + count);
        if (targeting) coByTargeting.set(targeting, (coByTargeting.get(targeting) || 0) + count);
        if (adText) coByAdText.set(adText, (coByAdText.get(adText) || 0) + count);
    }

    return { coByCreative, coByTargeting, coByAdText, totalCO };
}

export function processVKReport(adsData, groupsData, tempData, targetPhonesFromInput, config) {
    const { title, period, vat, ak } = config;
    const multiplier = vat * ak;
    const groupDict = buildGroupDictionary(groupsData);
    const processedAds = [];

    if (adsData) {
        const adNameIndex = findColumnIndex(adsData, ['название', 'name'], 0);
        const adSpentIndex = findColumnIndex(adsData, ['расход', 'spent'], 1);
        const adImpressionsIndex = findColumnIndex(adsData, ['показы', 'impressions'], 2);
        const adClicksIndex = findColumnIndex(adsData, ['клики', 'clicks'], 3);
        const adResultsIndex = findColumnIndex(adsData, ['результат', 'results'], 5);
        const adGroupIdIndex = findColumnIndex(adsData, ['id группы', 'group id'], 7);

        for (let i = 1; i < adsData.length; i++) {
            const row = adsData[i];
            if (!row || row.length < 8) continue;

            const adName = String(row[adNameIndex] || "");
            const spent = (Number(row[adSpentIndex]) || 0) * multiplier;
            if (spent <= 0) continue;

            const impressions = Number(row[adImpressionsIndex]) || 0;
            const clicks = Number(row[adClicksIndex]) || 0;
            const results = Number(row[adResultsIndex]) || 0;
            const groupId = normalizeId(row[adGroupIdIndex]);
            const targeting = findTargetingName(groupDict, groupId);
            const creative = findCreativeName(adName);
            const text = findTextName(adName);

            processedAds.push({ adName, spent, impressions, clicks, results, targeting, creative, text });
        }
    }

    const { coByCreative, coByTargeting, coByAdText, totalCO } = buildCOByAdId(
        adsData,
        groupsData,
        tempData,
        targetPhonesFromInput,
    );

    const creatives = new Map();
    const targetings = new Map();
    const adTexts = new Map();

    processedAds.forEach((ad) => {
        const updateMap = (map, key) => {
            if (!key) return;
            if (!map.has(key)) map.set(key, { spent: 0, impressions: 0, clicks: 0, results: 0, co: 0 });

            const item = map.get(key);
            item.spent += ad.spent;
            item.impressions += ad.impressions;
            item.clicks += ad.clicks;
            item.results += ad.results;
        };

        updateMap(creatives, ad.creative);
        updateMap(targetings, ad.targeting);
        updateMap(adTexts, ad.text);
    });

    const applyCO = (map, coMap) => {
        for (const [name, data] of map.entries()) {
            data.co = coMap.get(name) || 0;
        }

        for (const name of coMap.keys()) {
            if (!map.has(name)) {
                map.set(name, { spent: 0, impressions: 0, clicks: 0, results: 0, co: coMap.get(name) });
            }
        }
    };

    applyCO(creatives, coByCreative);
    applyCO(targetings, coByTargeting);
    applyCO(adTexts, coByAdText);

    const totalSpent = processedAds.reduce((sum, ad) => sum + ad.spent, 0);
    const totalImpressions = processedAds.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = processedAds.reduce((sum, ad) => sum + ad.clicks, 0);
    const totalResults = processedAds.reduce((sum, ad) => sum + ad.results, 0);

    return {
        title,
        period,
        totalSpent,
        totalImpressions,
        totalClicks,
        totalResults,
        totalCO,
        creatives: sortCreatives(Array.from(creatives.entries()).map(([name, data]) => ({ name, ...data }))),
        targetings: Array.from(targetings.entries()).map(([name, data]) => ({ name, ...data })),
        adTexts: sortTexts(Array.from(adTexts.entries()).map(([name, data]) => ({ name, ...data }))),
    };
}
