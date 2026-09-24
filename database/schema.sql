-- TapPay — schema
-- Run with:  psql -U tappay -d tappay -f database/schema.sql
--
-- Money is stored as a whole number of RWF in a BIGINT. RWF has no minor unit,
-- and integers keep arithmetic exact. No float ever touches a balance.

BEGIN;

DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS payment_sessions CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT        NOT NULL,
  email               TEXT        NOT NULL UNIQUE,
  password_hash       TEXT        NOT NULL,
  pin_hash            TEXT        NOT NULL,
  payment_id          TEXT        NOT NULL UNIQUE,
  role                TEXT        NOT NULL DEFAULT 'CUSTOMER'
                      CHECK (role IN ('CUSTOMER', 'MERCHANT')),
  failed_pin_attempts INTEGER     NOT NULL DEFAULT 0,
  pin_locked_until    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- wallets
-- One wallet per account. The CHECK is the last line of defence against a
-- negative balance; the application also guards every debit with balance >= amount.
CREATE TABLE wallets (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance    BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency   CHAR(3)     NOT NULL DEFAULT 'RWF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- transactions
-- The ledger. A row only exists for money that actually moved.
CREATE TABLE transactions (
  id          BIGSERIAL PRIMARY KEY,
  sender_id   BIGINT      NOT NULL REFERENCES users(id),
  receiver_id BIGINT      NOT NULL REFERENCES users(id),
  amount      BIGINT      NOT NULL CHECK (amount > 0),
  currency    CHAR(3)     NOT NULL DEFAULT 'RWF',
  method      TEXT        NOT NULL CHECK (method IN ('NFC', 'QR')),
  status      TEXT        NOT NULL DEFAULT 'COMPLETED'
              CHECK (status IN ('COMPLETED', 'FAILED', 'REVERSED')),
  reference   TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);

CREATE INDEX transactions_sender_idx   ON transactions (sender_id, created_at DESC);
CREATE INDEX transactions_receiver_idx ON transactions (receiver_id, created_at DESC);

-- ---------------------------------------------------------------- payment_sessions
-- POS / NFC payments. The session id is the only thing that travels over NFC.
CREATE TABLE payment_sessions (
  id             BIGSERIAL PRIMARY KEY,
  session_id     TEXT        NOT NULL UNIQUE,
  customer_id    BIGINT      REFERENCES users(id),
  merchant_id    BIGINT      NOT NULL REFERENCES users(id),
  amount         BIGINT      NOT NULL CHECK (amount > 0),
  currency       CHAR(3)     NOT NULL DEFAULT 'RWF',
  status         TEXT        NOT NULL DEFAULT 'WAITING'
                 CHECK (status IN ('WAITING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED')),
  -- One session can never point at two ledger entries: this is the
  -- database-level guarantee against a double payment.
  transaction_id BIGINT      UNIQUE REFERENCES transactions(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX payment_sessions_merchant_idx ON payment_sessions (merchant_id, created_at DESC);
CREATE INDEX payment_sessions_open_idx     ON payment_sessions (status) WHERE status = 'WAITING';

-- ---------------------------------------------------------------- payment_requests
-- QR person-to-person transfers, held until the receiver approves.
CREATE TABLE payment_requests (
  id             BIGSERIAL PRIMARY KEY,
  sender_id      BIGINT      NOT NULL REFERENCES users(id),
  receiver_id    BIGINT      NOT NULL REFERENCES users(id),
  amount         BIGINT      NOT NULL CHECK (amount > 0),
  currency       CHAR(3)     NOT NULL DEFAULT 'RWF',
  method         TEXT        NOT NULL DEFAULT 'QR' CHECK (method IN ('QR')),
  status         TEXT        NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'FAILED')),
  transaction_id BIGINT      UNIQUE REFERENCES transactions(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  CHECK (sender_id <> receiver_id)
);

CREATE INDEX payment_requests_receiver_idx ON payment_requests (receiver_id, created_at DESC);
CREATE INDEX payment_requests_sender_idx   ON payment_requests (sender_id, created_at DESC);

COMMIT;
