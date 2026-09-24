# TapPay

A virtual-money wallet with two payment flows:

1. **Tap to pay** — the customer holds their phone against a merchant terminal (NFC) and confirms with a payment PIN.
2. **QR person-to-person transfer** — one TapPay user scans another user's QR code, enters an amount, and the receiver approves before any money moves.

Balances are virtual RWF held in PostgreSQL. Nothing here touches a bank, a card network or a real settlement rail.

---

## Contents

| Folder | What it is | Stack |
|---|---|---|
| `backend/` | The API and the only place money moves | Node.js, Express, PostgreSQL, JWT, bcrypt |
| `mobile/` | Customer wallet app | React Native, Expo, React Navigation, Axios |
| `pos/` | Merchant terminal | React, Vite, Axios |
| `database/` | `schema.sql` and `seed.sql` | PostgreSQL |

---

## Architecture

```
  Customer phone                    Merchant terminal
  (React Native)                    (React web app)
        │                                  │
        │  1. terminal advertises          │  opens a payment session
        │     a session code over NFC      │  and polls for the result
        │ ◄────────────────────────────────┤
        │                                  │
        └──────────────┬───────────────────┘
                       │  HTTPS + JWT
                       ▼
             Node.js / Express API
                       │
                       ▼
                  PostgreSQL
        users · wallets · payment_sessions
        payment_requests · transactions
```

The terminal and the phone never trust each other. They both talk to the backend, and the backend decides everything: the amount, the identities, whether the PIN is right, whether the balance is sufficient, and whether the payment already happened.

### What the phone sends, and what it does not

Over NFC the phone receives one thing: a session code such as `SESSION_8F42K9AB`. That code is worthless on its own. To turn it into a payment you also need the customer's JWT and their payment PIN, and the session expires after two minutes. No PIN, password, balance, token or key is ever placed in an NFC payload or a QR code.

---

## The NFC flow

```
1. Merchant enters 5,000 RWF on the terminal.
2. Terminal  ──POST /api/payment-sessions──►  backend
   Backend creates SESSION_… with status WAITING, expiring in 2 minutes.
3. Terminal displays the amount and waits. It polls
   GET /api/payment-sessions/:sessionId for the status.
4. Customer opens TapPay → Tap to pay → holds the phone to the terminal.
5. Phone reads the session code from the terminal over NDEF.
6. Phone  ──GET /api/payment-sessions/:sessionId──►  backend
   Phone now shows "Coffee Shop — 5,000 RWF".
7. Customer types their payment PIN.
8. Phone  ──POST /api/payment-sessions/:sessionId/authorize {pin}──►  backend
9. Backend verifies the PIN, claims the session, moves the money in one
   database transaction, writes a transaction row, marks the session COMPLETED.
10. The terminal's next poll sees COMPLETED and shows the receipt.
```

The customer's phone never tells the terminal that the payment worked. The terminal learns it from the backend.

## The QR flow

```
1. Alice opens My QR. It renders tappay://pay/TP_ALICE7 and nothing else.
2. John opens Send money and scans it.
3. John's phone  ──GET /api/users/payment/TP_ALICE7──►  backend
   The backend returns a display name. Not an email, not a balance, not an id.
4. John enters 10,000 RWF and his payment PIN.
5. John's phone  ──POST /api/payment-requests──►  backend
   A PENDING request is created. No money moves.
6. Alice sees it under Requests.
7. Alice approves  ──PATCH /api/payment-requests/:id/approve──►  backend
   Only now does the backend debit John and credit Alice, in one transaction.
   If Alice rejects, the request becomes REJECTED and nothing moves.
```

---

## Database

Money is stored as a whole number of RWF in a `BIGINT`. RWF has no minor unit and integers keep arithmetic exact, so no float ever touches a balance.

- **users** — `name, email, password_hash, pin_hash, payment_id, role (CUSTOMER|MERCHANT)`, plus `failed_pin_attempts` and `pin_locked_until` for PIN lockout.
- **wallets** — one per user, `balance BIGINT CHECK (balance >= 0)`, `currency`.
- **payment_sessions** — the NFC/POS flow. `session_id, customer_id, merchant_id, amount, status, expires_at` and a `transaction_id` with a `UNIQUE` constraint.
- **payment_requests** — the QR flow. `sender_id, receiver_id, amount, method, status, expires_at`, also with a unique `transaction_id`.
- **transactions** — the ledger. A row exists only for money that actually moved. `method` is `NFC` or `QR`.

---

## Payment processing

All settlement lives in `backend/src/services/paymentService.js`. Every payment follows the same shape:

```
verify the PIN (outside the transaction, so bcrypt never holds a row lock)
BEGIN
  claim the session / request with one conditional UPDATE
  lock both wallets FOR UPDATE, lowest user_id first
  debit  ... WHERE balance >= amount     ← guarded, cannot go negative
  credit ...
  INSERT INTO transactions
  mark the session / request COMPLETED or APPROVED
COMMIT
```

Anything that throws rolls the whole thing back.

### Double payments

Four independent guards, any one of which is sufficient:

1. The session is claimed with `UPDATE ... SET status='AUTHORIZED' WHERE session_id=$1 AND status='WAITING' AND expires_at > now()`. Only one caller can ever get a row back; everyone else gets a 409.
2. `payment_sessions.transaction_id` and `payment_requests.transaction_id` are `UNIQUE`, so a second ledger row cannot be attached.
3. Wallets are locked `FOR UPDATE` in a deterministic order.
4. The debit is conditional on `balance >= amount`, and the column carries `CHECK (balance >= 0)`.

Verified: five simultaneous `authorize` calls against one session returned `200, 409, 409, 409, 409` with a single debit.

### Insufficient balance

The debit returns zero rows, the session is marked `FAILED`, and the API responds:

```json
{ "success": false, "message": "Insufficient wallet balance" }
```

---

## Security

- Passwords and PINs are hashed with bcrypt (cost 10). Neither is ever stored or logged in plain text, and neither is ever returned by the API.
- JWT bearer authentication on every route except register, login and `/health`.
- Role checks: only a `MERCHANT` can open or cancel a payment session; only a `CUSTOMER` can authorise one.
- PIN lockout: after five wrong PINs the account cannot pay for fifteen minutes.
- Rate limiting on register and login.
- Every SQL statement is parameterised. No string concatenation anywhere.
- CORS runs from an allow-list in `CORS_ORIGINS`; `helmet` sets the usual headers.
- Secrets live in `.env`, which is git-ignored. `.env.example` shows the shape.
- Sessions expire after 2 minutes, QR requests after 24 hours, both lazily on read and on a background sweep.

The frontend is never trusted for the balance, the amount, the payment status, the user's identity or the authorisation. The amount charged is read from the session row, not from the request body. The payer is read from the JWT, not from the request body.

---

## Local setup

Requirements: Node.js 18+, PostgreSQL 14+, and for real NFC an Android phone with NFC.

### 1. PostgreSQL

```bash
createuser tappay --pwprompt          # or: psql -c "CREATE USER tappay WITH PASSWORD 'tappay'"
createdb -O tappay tappay

psql -h localhost -U tappay -d tappay -f database/schema.sql
psql -h localhost -U tappay -d tappay -f database/seed.sql
```

The seed creates three accounts. All use the password `Password123`:

| Account | Email | PIN | Balance | Role |
|---|---|---|---|---|
| Alice Uwase (`TP_ALICE7`) | alice@example.com | 1234 | 20,000 RWF | customer |
| John Mugisha (`TP_JOHN42`) | john@example.com | 2468 | 50,000 RWF | customer |
| Coffee Shop (`TP_COFFEE`) | merchant@example.com | 1234 | 10,000 RWF | merchant |

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste into JWT_SECRET
npm start
```

Check it: `curl http://localhost:4000/health`

### 3. POS terminal

```bash
cd pos
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm run dev               # http://localhost:5173
```

Sign in as `merchant@example.com`.

### 4. Mobile app

```bash
cd mobile
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` to your machine's LAN address, for example `http://192.168.1.10:4000/api`. A phone cannot reach your laptop's `localhost`. Add that same origin to `CORS_ORIGINS` in the backend `.env` if you open the API from a browser.

```bash
npx expo start            # QR/camera features and the typed-code path work here
```

For NFC you need a development build, not Expo Go:

```bash
npx expo prebuild
npx expo run:android      # on a physical NFC phone
```

---

## Testing the payment flows

An end-to-end script exercises both flows and the failure paths. With the backend running and the database seeded:

```bash
node backend/scripts/smoke-test.js
```

It checks the happy paths plus: replayed authorisation, wrong PIN, insufficient balance, a merchant trying to authorise a customer payment, sending to yourself, double approval, rejection, and unauthenticated access.

To try it by hand:

**NFC** — sign in to the POS, charge 5,000 RWF, then in the app go to Tap to pay. On an NFC build, tap the phone against the terminal. Otherwise type the code shown on the terminal screen into the "Type the payment code" field. Confirm with PIN `1234`. Alice goes 20,000 → 15,000; Coffee Shop goes 10,000 → 15,000.

**QR** — sign in as John, open Send money, scan Alice's QR (or type `TP_ALICE7`), enter 10,000, PIN `2468`. Sign in as Alice, open Requests, approve.

---

## NFC hardware and platform limits

This is the honest part, and it matters for your demo.

**What is implemented.** `mobile/src/services/nfcService.js` is a real NDEF reader built on `react-native-nfc-manager`. The phone reads a session code from the terminal, parses `tappay://session/SESSION_…`, and hands it to the payment flow. The full payment-session system — backend, terminal, expiry, claiming, settlement — is real and complete, and it is the part a production NFC implementation would plug into unchanged.

**What is not implemented, and why.**

1. *Phone as the card.* In a real shop the merchant reader reads the phone, not the other way round. That requires Host Card Emulation on Android — a native `HostApduService` registered with an AID, written in Kotlin or Java, which cannot be expressed in JavaScript — or on iOS the NFC & Secure Element entitlements, which Apple grants only to approved payment providers. Neither is in this MVP.
2. *Expo Go and simulators.* `react-native-nfc-manager` is a native module. It does nothing in Expo Go and nothing in a simulator. You need `npx expo prebuild` and a development build on a physical NFC device.
3. *iOS reading.* iPhone 7 and later can read NDEF tags with the NFC entitlement configured in `app.json`, but background tag reading and card emulation stay restricted.

**What the app does when NFC is unavailable.** It says so, and offers a second path: read the session code off the terminal screen and type it. That path is labelled in the UI as typing a code. It is not presented as NFC, and QR is not substituted for NFC anywhere — QR is only ever used for person-to-person transfers, exactly as specified.

**To make NFC real on Android**, you would: write an HCE service exposing a TapPay AID; have it return the session code the phone is currently holding; configure the merchant reader to select that AID and read the response; and leave the rest of this codebase untouched, because the terminal already opens sessions and the backend already settles them.

---

## API

| Method | Route | Who | What |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | Create an account, hash password and PIN, allocate a payment ID, create a wallet |
| POST | `/api/auth/login` | anyone | Return a JWT |
| GET | `/api/auth/me` | signed in | The current account |
| GET | `/api/wallet` | signed in | Balance and currency |
| GET | `/api/wallet/merchant-summary` | merchant | Balance and today's takings |
| GET | `/api/users/me/qr` | signed in | The payload to render as a QR code |
| GET | `/api/users/payment/:paymentId` | signed in | Resolve a scanned code to a display name |
| POST | `/api/payment-sessions` | merchant | Open a session for an amount |
| GET | `/api/payment-sessions/mine` | merchant | Recent sessions for this till |
| GET | `/api/payment-sessions/:sessionId` | signed in | Session status, merchant and amount |
| POST | `/api/payment-sessions/:sessionId/authorize` | customer | Confirm with a PIN and settle |
| POST | `/api/payment-sessions/:sessionId/cancel` | merchant | Abandon a charge |
| POST | `/api/payment-requests` | signed in | Create a PENDING QR transfer |
| GET | `/api/payment-requests/received` | signed in | Requests awaiting your approval |
| GET | `/api/payment-requests/sent` | signed in | Requests you created |
| PATCH | `/api/payment-requests/:id/approve` | receiver | Settle the transfer |
| PATCH | `/api/payment-requests/:id/reject` | receiver | Refuse it, no money moves |
| GET | `/api/transactions` | signed in | Your ledger, both methods |
| GET | `/api/transactions/:id` | signed in | One transaction, if it is yours |

---

## Scope

This is a prototype with virtual money. Real settlement, card networks, financial licensing, device secure elements and production payment credentials are deliberately outside it. See `PROJECT_PROPOSAL.md` for what a production version would need.
