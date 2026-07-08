-- Схема БД для VK Report Generator.
-- Пока одна таблица: пользователи, вошедшие через Google.
-- Применить: npm run db:init (из папки server/).

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    google_sub    TEXT        NOT NULL UNIQUE,          -- стабильный идентификатор Google-аккаунта (claim "sub")
    email         TEXT        NOT NULL UNIQUE,
    name          TEXT,
    picture_url   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Поиск по email при входе.
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Личные настройки пользователя (множители, стиль Excel, формат вывода) — одна
-- строка на пользователя, подставляются в форму при следующем визите.
CREATE TABLE IF NOT EXISTS user_settings (
    user_id          BIGINT       PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    vat              NUMERIC(4,2) NOT NULL DEFAULT 1.22,
    ak1              NUMERIC(4,2) NOT NULL DEFAULT 1,
    ak2              NUMERIC(4,2) NOT NULL DEFAULT 1,
    ak3              NUMERIC(4,2) NOT NULL DEFAULT 1,
    font_name        TEXT         NOT NULL DEFAULT 'Montserrat',
    font_size        SMALLINT     NOT NULL DEFAULT 10,
    horizontal_align TEXT         NOT NULL DEFAULT 'center',
    vertical_align   TEXT         NOT NULL DEFAULT 'middle',
    number_format    TEXT         NOT NULL DEFAULT 'integer',
    output_format    TEXT         NOT NULL DEFAULT 'xlsx',
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Google-таблицы, в которые пользователь успешно выгружал отчёты — личный список
-- (не общий), подставляется в автодополнение поля ссылки на таблицу.
CREATE TABLE IF NOT EXISTS saved_spreadsheets (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    spreadsheet_id TEXT        NOT NULL,
    title          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, spreadsheet_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_spreadsheets_user ON saved_spreadsheets (user_id, last_used_at DESC);
