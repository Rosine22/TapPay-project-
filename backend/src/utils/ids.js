const crypto = require('crypto');

// Unambiguous alphabet: no 0/O, no 1/I — these codes get read aloud and typed.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

const paymentId = () => `TP_${randomCode(6)}`;
const sessionId = () => `SESSION_${randomCode(8)}`;
const transactionReference = () => `TXN_${randomCode(8)}`;

module.exports = { randomCode, paymentId, sessionId, transactionReference };
