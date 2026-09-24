-- TapPay — demo data
-- Run AFTER schema.sql:  psql -U tappay -d tappay -f database/seed.sql
--
-- Every account below uses the password  Password123
-- PINs:  Alice 1234 | John 2468 | Coffee Shop 1234
-- The hashes are real bcrypt (cost 10) digests, so the normal login and PIN
-- checks apply to seeded accounts exactly as they do to registered ones.

BEGIN;

TRUNCATE payment_requests, payment_sessions, transactions, wallets, users RESTART IDENTITY CASCADE;

INSERT INTO users (name, email, password_hash, pin_hash, payment_id, role) VALUES
  ('Alice Uwase', 'alice@example.com',
   '$2b$10$.3packD4eejvkVnWGKYwy.DGJDmEqGCvVvo928FRRgxLOlzdUlv62',
   '$2b$10$krUDIiDvTesN9FeLs55R6eYJx70HZrQYtC31ASY5ayPPEoM2mSwRO',
   'TP_ALICE7', 'CUSTOMER'),
  ('John Mugisha', 'john@example.com',
   '$2b$10$.3packD4eejvkVnWGKYwy.DGJDmEqGCvVvo928FRRgxLOlzdUlv62',
   '$2b$10$boRMv.3kBK49.iRuyNp8w.NfeFZyyx.qBR7YgtOJ2Nb/SLexJOl3e',
   'TP_JOHN42', 'CUSTOMER'),
  ('Coffee Shop', 'merchant@example.com',
   '$2b$10$.3packD4eejvkVnWGKYwy.DGJDmEqGCvVvo928FRRgxLOlzdUlv62',
   '$2b$10$krUDIiDvTesN9FeLs55R6eYJx70HZrQYtC31ASY5ayPPEoM2mSwRO',
   'TP_COFFEE', 'MERCHANT');

INSERT INTO wallets (user_id, balance, currency)
SELECT id,
       CASE email
         WHEN 'alice@example.com'    THEN 20000
         WHEN 'john@example.com'     THEN 50000
         WHEN 'merchant@example.com' THEN 10000
       END,
       'RWF'
FROM users;

COMMIT;

SELECT u.name, u.payment_id, u.role, w.balance || ' ' || w.currency AS wallet
FROM users u JOIN wallets w ON w.user_id = u.id ORDER BY u.id;
