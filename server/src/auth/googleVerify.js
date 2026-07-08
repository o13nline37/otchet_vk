// Проверка Google access token (OAuth2), а не ID-токена: фронтенд теперь запрашивает
// доступ сразу с двумя scope (профиль + Google Таблицы) одним окном согласия, поэтому
// у нас на руках access token, а не подписанный JWT. Проверяем его напрямую через Google:
// 1) tokeninfo — что токен валиден и выдан именно для нашего OAuth-клиента (audience);
// 2) userinfo — забираем профиль (email, имя, фото, stable id).
import { config } from '../config.js';

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export async function verifyGoogleAccessToken(accessToken) {
    if (!accessToken || typeof accessToken !== 'string') {
        throw new Error('Не передан Google access token');
    }

    let tokenInfo;
    try {
        const tokenInfoResponse = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
        if (!tokenInfoResponse.ok) throw new Error('bad tokeninfo response');
        tokenInfo = await tokenInfoResponse.json();
    } catch {
        throw new Error('Google access token недействителен или просрочен');
    }

    // Токен должен быть выдан именно для нашего OAuth-клиента — иначе токен,
    // полученный сторонним приложением, мог бы использоваться для входа к нам.
    if (tokenInfo.aud !== config.googleClientId && tokenInfo.azp !== config.googleClientId) {
        throw new Error('Google access token выдан для другого приложения');
    }

    let profile;
    try {
        const userInfoResponse = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoResponse.ok) throw new Error('bad userinfo response');
        profile = await userInfoResponse.json();
    } catch {
        throw new Error('Не удалось получить профиль Google-аккаунта');
    }

    // Google подтверждает, что пользователь реально владеет этим email.
    // Без этой проверки whitelist по домену можно обойти неподтверждённым адресом.
    if (!profile.email || profile.email_verified !== true) {
        throw new Error('Email Google-аккаунта не подтверждён');
    }

    return {
        googleSub: profile.sub,
        email: String(profile.email).toLowerCase(),
        name: profile.name || null,
        pictureUrl: profile.picture || null,
    };
}
