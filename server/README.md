# Backend — вход через Google для VK Report Generator

Небольшой Express-бэкенд: проверяет вход через Google и пускает на сайт только сотрудников 108 Media.
Без сборки, ES-модули, требует Node 20+.

## Что делает

- `POST /api/auth/google` — принимает Google access token (фронтенд запрашивает его сразу со scope профиля и Google Таблиц одним окном согласия), проверяет его через Google (`tokeninfo` + `userinfo`), сверяет email с whitelist 108 Media, заводит/обновляет пользователя в БД и возвращает наш сессионный JWT.
- `GET /api/auth/me` — по сессионному JWT возвращает текущего пользователя (используется для «запомнить вход»).
- `POST /api/auth/logout` — заглушка (токены stateless, выход происходит на клиенте).
- `GET /api/settings` / `PUT /api/settings` — личные настройки пользователя (множители НДС/АК, стиль Excel, формат вывода). Требуют сессионный JWT. Фронтенд подставляет их в форму при входе и пересохраняет при каждой успешной генерации отчёта — см. `js/userSettings.js`.
- `GET /health` — проверка живости.

## Настройка (один раз)

### 1. База данных (PostgreSQL)

Проще всего — бесплатный облачный Postgres, без установки локально:

- **Neon** (https://neon.tech) или **Supabase** (https://supabase.com) → создать проект → скопировать connection string (`postgres://...`).

Для облачных провайдеров нужен SSL — оставьте `DATABASE_SSL=require`.
Для локального Postgres поставьте `DATABASE_SSL=disable`.

### 2. Переменные окружения

```bash
cp .env.example .env
```

Заполните в `.env`:

- `DATABASE_URL` — строка подключения из шага 1.
- `JWT_SECRET` — случайная длинная строка. Сгенерировать:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- `ALLOWED_EMAIL_DOMAINS` — **реальный рабочий домен 108 Media** (например `108media.ru`). Именно он ограничивает вход. При необходимости добавьте точечные адреса в `ALLOWED_EMAILS`.
- `GOOGLE_CLIENT_ID` — уже заполнен (тот же, что на фронтенде). Менять не нужно.
- `CORS_ORIGIN` — адрес(а) фронтенда. Локально `http://127.0.0.1:8000`; для прода добавьте URL GitHub Pages.

> ⚠️ Если и `ALLOWED_EMAIL_DOMAINS`, и `ALLOWED_EMAILS` пусты, сервер не запустится — иначе вход получил бы любой Google-аккаунт.

### 3. Google Cloud Console

OAuth consent screen сейчас в режиме **Testing**, поэтому каждый сотрудник 108 Media должен быть добавлен в **Test users** (APIs & Services → OAuth consent screen), иначе Google не даст ему войти. Это же требуется для экспорта в Google Sheets.

Также в **Credentials → OAuth client ID → Authorized JavaScript origins** должен быть указан адрес, с которого открывается фронтенд (локальный и/или GitHub Pages).

## Запуск

```bash
npm install
npm run db:init   # применить схему (db/schema.sql) — один раз или после изменений схемы
npm run dev       # API на http://localhost:3000 (--watch)
```

Затем откройте фронтенд (`python -m http.server 8000` из корня репозитория) и войдите через Google.

Кнопка входа сразу запрашивает доступ и к профилю, и к Google Таблицам одним окном
согласия — поэтому при последующем экспорте отчёта в Google Sheets повторный запрос
доступа уже не показывается (см. `js/authGate.js` и `js/googleAuth.js`).

## Прод

`npm start` вместо `npm run dev`. Разверните где угодно, где есть Node (Render, Railway, VPS). После деплоя:
- пропишите URL бэкенда в `PROD_API_BASE_URL` в `js/config.js`;
- добавьте домен фронтенда в `CORS_ORIGIN`.
