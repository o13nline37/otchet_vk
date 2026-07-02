const phoneCache = new Map();

export function clearPhoneCache() {
    phoneCache.clear();
}

export function normalizePhone(raw) {
    if (raw === null || raw === undefined || raw === "") return "";

    let phone = String(raw).replace(/\D/g, "");
    if (phone.length === 11 && phone.startsWith("8")) phone = "7" + phone.slice(1);
    if (phone.length === 10) phone = "7" + phone;
    if (phone.length === 11 && phone.startsWith("7")) return phone;

    if (phone.length > 11) {
        const last11 = phone.slice(-11);
        if (last11.startsWith("7")) return last11;
    }

    return "";
}

export function normalizePhoneCached(raw) {
    if (phoneCache.has(raw)) return phoneCache.get(raw);

    const result = normalizePhone(raw);
    phoneCache.set(raw, result);
    return result;
}
