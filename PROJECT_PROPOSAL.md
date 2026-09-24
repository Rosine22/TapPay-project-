# TapPay — project proposal

## The problem

Paying a small merchant in Kigali today means cash, or a USSD flow that takes a
dozen keypresses and a shared phone number written on a piece of cardboard at the
till. Both are slow at a busy counter. Cash also leaves the merchant with no
record of what was taken and when.

TapPay is a wallet prototype for the interaction people actually want at a
counter: hold the phone to the terminal, confirm with a PIN, walk away. It also
covers the second thing wallets are used for — sending money to another person —
without confusing the two.

## Two flows, deliberately kept apart

**Tap to pay (NFC)** is the primary flow. It is customer-to-merchant. The phone
touches a payment terminal, never another phone.

**QR** is only ever person-to-person. A QR code identifies a TapPay account so
another user can send money to it. QR is never used as the merchant payment
method, and never substituted for NFC.

Keeping these separate is a product decision as much as a technical one. A
customer who learns "tap at a shop, scan a friend" has one rule for each
situation. A wallet that uses QR for both teaches nothing.

## Scope of this MVP

In scope:

- Customer registration with a password and a separate payment PIN
- A virtual RWF wallet per account, starting at zero
- Merchant accounts and a terminal interface that opens payment sessions
- The complete NFC payment-session system, end to end, backend and terminal
- An NFC reader implementation in the mobile app, plus an honest fallback
- QR person-to-person transfers with receiver approval
- Transaction history distinguishing NFC from QR
- Server-side validation of every balance, amount, identity and authorisation

Out of scope, on purpose:

- Real bank accounts, card networks and settlement
- Financial regulation, KYC, AML
- Device secure elements and production payment credentials
- Host Card Emulation, which needs native Android code and is documented as such
- Top-ups and withdrawals
- Refunds and reversals, though the ledger has a `REVERSED` status reserved
- Push notifications, so the app polls instead

## Technical approach

Node.js and Express for the API, PostgreSQL for state, React Native with Expo for
the wallet, and a small React app for the terminal. No Kubernetes, no
microservices, no message broker, no cache, no GraphQL. The whole system is three
processes and one database, which is the right size for the problem and small
enough to reason about completely.

The design rule that everything else follows from: **the backend is the only
source of truth.** The phone and the terminal are both untrusted clients. The
amount comes from a database row. The payer comes from a JWT. The result comes
from a transaction that either commits or does not. Neither client can assert
anything about money.

Settlement is confined to one module, so the rules that matter — verify the PIN,
claim the session exactly once, lock both wallets, guard the debit, write the
ledger — are stated once and cannot drift apart between the two flows.

## Risks

**NFC on the phone side is the hard part.** Reading a terminal works from
JavaScript. Emulating a card so an existing merchant reader can read the phone
does not; it needs a native Android HCE service or an Apple entitlement. The
architecture is built so that this is a swap of one module: the session system,
the terminal and the backend are unaffected by how the phone obtains the session
code.

**Virtual money hides real problems.** With no external rail there is no
reconciliation, no chargeback, no float management. A production version would
need all three.

**PIN entropy is low.** A 4-digit PIN is guessable, which is why lockout after
five failures is in the MVP rather than deferred.

## What production would need

Real settlement through a licensed provider; KYC and transaction limits; HCE with
an EMV-compatible payload; push notifications instead of polling; refunds and
reversals; an append-only audit log; observability; and an independent security
review before a single real franc moves.

## Deliverables

Working source for `mobile/`, `pos/`, `backend/` and `database/`, this proposal,
and a README covering architecture, both flows, setup, testing and the NFC
platform limits in full.
