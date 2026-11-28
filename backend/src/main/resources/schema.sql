-- Ershak database schema (SQLite).
-- Money is stored as TEXT and handled as BigDecimal in Java to avoid rounding errors.
-- Times are epoch milliseconds.

CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name            TEXT    NOT NULL,
    email                TEXT    NOT NULL UNIQUE,
    phone                TEXT    NOT NULL UNIQUE,
    username             TEXT    NOT NULL UNIQUE,
    password_hash        TEXT    NOT NULL,
    salt                 TEXT    NOT NULL,
    role                 TEXT    NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN')),
    failed_attempts      INTEGER NOT NULL DEFAULT 0,
    locked_until         INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users (id),
    account_number TEXT    NOT NULL UNIQUE,
    type           TEXT    NOT NULL CHECK (type IN ('SAVINGS', 'CURRENT')),
    balance        TEXT    NOT NULL,
    hold_amount    TEXT    NOT NULL DEFAULT '0.00',
    status         TEXT    NOT NULL CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    opened_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference       TEXT    NOT NULL UNIQUE,
    type            TEXT    NOT NULL,
    from_account_id INTEGER REFERENCES accounts (id),
    to_account_id   INTEGER REFERENCES accounts (id),
    amount          TEXT    NOT NULL,
    fee             TEXT    NOT NULL DEFAULT '0.00',
    status          TEXT    NOT NULL,
    initiated_by    INTEGER NOT NULL REFERENCES users (id),
    note            TEXT,
    created_at      INTEGER NOT NULL,
    completed_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions (from_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions (to_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (initiated_by, created_at);

CREATE TABLE IF NOT EXISTS fraud_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions (id),
    score          INTEGER NOT NULL,
    rules          TEXT    NOT NULL,
    decision       TEXT    NOT NULL,
    reviewed_by    INTEGER REFERENCES users (id),
    reviewed_at    INTEGER,
    created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
    transaction_id INTEGER PRIMARY KEY REFERENCES transactions (id),
    code_hash      TEXT    NOT NULL,
    expires_at     INTEGER NOT NULL,
    attempts       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS savings_goals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users (id),
    account_id    INTEGER NOT NULL REFERENCES accounts (id),
    name          TEXT    NOT NULL,
    target_amount TEXT    NOT NULL,
    saved_amount  TEXT    NOT NULL DEFAULT '0.00',
    target_date   TEXT,
    status        TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    kind       TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS sms_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    message    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            INTEGER NOT NULL,
    actor         TEXT    NOT NULL,
    action        TEXT    NOT NULL,
    details       TEXT    NOT NULL,
    previous_hash TEXT    NOT NULL,
    hash          TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ===== Coach: personal-finance tracking (expenses, categories, budgets) =====

-- Spending categories. user_id NULL = a built-in category everyone sees.
CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users (id),
    code       TEXT,
    name_ar    TEXT    NOT NULL,
    name_en    TEXT    NOT NULL,
    icon       TEXT    NOT NULL,
    color      TEXT    NOT NULL,
    essential  INTEGER NOT NULL CHECK (essential IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users (id),
    category_id INTEGER NOT NULL REFERENCES categories (id),
    amount      TEXT    NOT NULL,
    note        TEXT,
    merchant    TEXT,
    source      TEXT    NOT NULL CHECK (source IN ('MANUAL', 'RECEIPT', 'SMS', 'BANK')),
    spent_at    INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses (user_id, spent_at);

-- One spending budget per user per month (month = 'YYYY-MM').
CREATE TABLE IF NOT EXISTS budgets (
    user_id INTEGER NOT NULL REFERENCES users (id),
    month   TEXT    NOT NULL,
    amount  TEXT    NOT NULL,
    PRIMARY KEY (user_id, month)
);

-- Alerts already sent, so the same alert is not repeated in a month.
CREATE TABLE IF NOT EXISTS coach_alerts (
    user_id INTEGER NOT NULL REFERENCES users (id),
    month   TEXT    NOT NULL,
    code    TEXT    NOT NULL,
    PRIMARY KEY (user_id, month, code)
);

-- ===== Push notifications (Web Push) =====

-- One row per browser/device that allowed notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    endpoint    TEXT    NOT NULL UNIQUE,
    p256dh      TEXT    NOT NULL,
    auth        TEXT    NOT NULL,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- When and what to remind each customer about. Times are Cairo local "HH:MM".
CREATE TABLE IF NOT EXISTS reminder_prefs (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id),
    daily        INTEGER NOT NULL DEFAULT 1,
    time         TEXT    NOT NULL DEFAULT '21:00',
    weekly       INTEGER NOT NULL DEFAULT 1,
    weekly_day   TEXT    NOT NULL DEFAULT 'fri',
    budget       INTEGER NOT NULL DEFAULT 1,
    goals        INTEGER NOT NULL DEFAULT 1,
    quiet_from   TEXT    NOT NULL DEFAULT '00:00',
    quiet_to     TEXT    NOT NULL DEFAULT '08:00',
    last_daily   TEXT,
    last_weekly  TEXT
);
