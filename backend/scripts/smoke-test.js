/**
 * End-to-end check of both payment flows against a running backend.
 *
 *   1. start PostgreSQL and load database/schema.sql + database/seed.sql
 *   2. npm start
 *   3. node scripts/smoke-test.js
 *
 * It exercises the happy paths and the failure paths that matter:
 * replayed payments, wrong PIN, insufficient balance, double approval.
 */
const BASE = process.env.API_URL || 'http://localhost:4000/api';

let failures = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail ? JSON.stringify(detail) : '');
  }
}

const login = async (email) => {
  const { body } = await call('POST', '/auth/login', { body: { email, password: 'Password123' } });
  return body.token;
};

const balance = async (token) => (await call('GET', '/wallet', { token })).body.wallet.balance;

(async () => {
  const alice = await login('alice@example.com');
  const john = await login('john@example.com');
  const shop = await login('merchant@example.com');
  check('all three seeded accounts sign in', alice && john && shop);

  const aliceStart = await balance(alice);
  const shopStart = await balance(shop);

  console.log('\nNFC / POS payment');
  const created = await call('POST', '/payment-sessions', { token: shop, body: { amount: 5000 } });
  const sessionId = created.body.session.sessionId;
  check('POS opens a session in WAITING', created.body.session.status === 'WAITING', created.body);

  const seen = await call('GET', `/payment-sessions/${sessionId}`, { token: alice });
  check('phone reads merchant and amount from the session', seen.body.session.merchantName === 'Coffee Shop' && seen.body.session.amount === 5000, seen.body);

  const paid = await call('POST', `/payment-sessions/${sessionId}/authorize`, { token: alice, body: { pin: '1234' } });
  check('payment succeeds with the right PIN', paid.status === 200 && paid.body.transaction.method === 'NFC', paid.body);

  const replay = await call('POST', `/payment-sessions/${sessionId}/authorize`, { token: alice, body: { pin: '1234' } });
  check('a replayed authorise is refused', replay.status === 409, replay.body);

  check('customer debited exactly once', (await balance(alice)) === aliceStart - 5000);
  check('merchant credited exactly once', (await balance(shop)) === shopStart + 5000);

  const s2 = (await call('POST', '/payment-sessions', { token: shop, body: { amount: 1000 } })).body.session.sessionId;
  const wrongPin = await call('POST', `/payment-sessions/${s2}/authorize`, { token: alice, body: { pin: '9999' } });
  check('wrong PIN is rejected', wrongPin.status === 401, wrongPin.body);
  check('no money moved on a wrong PIN', (await balance(alice)) === aliceStart - 5000);

  const s3 = (await call('POST', '/payment-sessions', { token: shop, body: { amount: 9000000 } })).body.session.sessionId;
  const broke = await call('POST', `/payment-sessions/${s3}/authorize`, { token: alice, body: { pin: '1234' } });
  check('payment above the balance is refused', broke.status === 402 && /Insufficient/i.test(broke.body.message), broke.body);
  check('balance never goes negative', (await balance(alice)) === aliceStart - 5000);

  const merchantPays = await call('POST', `/payment-sessions/${s3}/authorize`, { token: shop, body: { pin: '1234' } });
  check('a merchant token cannot authorise a customer payment', merchantPays.status === 403, merchantPays.body);

  console.log('\nQR person-to-person transfer');
  const lookup = await call('GET', '/users/payment/TP_ALICE7', { token: john });
  check('scanned code resolves to a name only', lookup.body.user.name === 'Alice Uwase' && lookup.body.user.email === undefined, lookup.body);

  const johnStart = await balance(john);
  const aliceBefore = await balance(alice);

  const request = await call('POST', '/payment-requests', {
    token: john,
    body: { receiverPaymentId: 'TP_ALICE7', amount: 10000, pin: '2468' },
  });
  check('request is created as PENDING', request.body.request.status === 'PENDING', request.body);
  check('no money moves before approval', (await balance(john)) === johnStart);

  const received = await call('GET', '/payment-requests/received', { token: alice });
  check('receiver sees the pending request', received.body.requests.some((r) => r.id === request.body.request.id));

  const approved = await call('PATCH', `/payment-requests/${request.body.request.id}/approve`, { token: alice });
  check('approval settles the transfer', approved.status === 200 && approved.body.transaction.method === 'QR', approved.body);
  check('sender debited', (await balance(john)) === johnStart - 10000);
  check('receiver credited', (await balance(alice)) === aliceBefore + 10000);

  const doubleApprove = await call('PATCH', `/payment-requests/${request.body.request.id}/approve`, { token: alice });
  check('a second approval is refused', doubleApprove.status === 409, doubleApprove.body);

  const selfSend = await call('POST', '/payment-requests', {
    token: john,
    body: { receiverPaymentId: 'TP_JOHN42', amount: 100, pin: '2468' },
  });
  check('sending to yourself is refused', selfSend.status === 409, selfSend.body);

  const rejectable = await call('POST', '/payment-requests', {
    token: john,
    body: { receiverPaymentId: 'TP_ALICE7', amount: 500, pin: '2468' },
  });
  const rejected = await call('PATCH', `/payment-requests/${rejectable.body.request.id}/reject`, { token: alice });
  check('rejection moves no money', rejected.body.request.status === 'REJECTED' && (await balance(john)) === johnStart - 10000);

  console.log('\nAuthentication');
  const noToken = await call('GET', '/wallet');
  check('wallet requires a token', noToken.status === 401);
  const badLogin = await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'wrong' } });
  check('wrong password is rejected', badLogin.status === 401);

  const txns = await call('GET', '/transactions', { token: alice });
  check('history shows both methods', txns.body.transactions.some((t) => t.method === 'NFC') && txns.body.transactions.some((t) => t.method === 'QR'));

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
