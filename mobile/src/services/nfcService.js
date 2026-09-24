/**
 * NFC for TapPay.
 *
 * What this module does: it reads an NDEF message from the payment terminal and
 * pulls a payment session code out of it. Nothing else travels over NFC — no
 * PIN, no token, no balance. The session code is short-lived and useless on its
 * own, because paying still needs the customer's JWT and PIN.
 *
 * What this module does NOT do — read this before demoing:
 *
 *  1. It is a *reader*. The phone reads the terminal. Emulating a contactless
 *     card so a normal merchant reader can read the phone (Android Host Card
 *     Emulation, or Apple's restricted NFC & SE APIs) cannot be done from
 *     JavaScript; it needs a native Android HCE service, or on iOS an entitlement
 *     Apple grants case by case. See README → "NFC hardware and platform limits".
 *  2. It does not work in Expo Go or in a simulator. react-native-nfc-manager is
 *     a native module, so it needs a development build on a physical NFC phone.
 *  3. When NFC is unavailable this module says so. It never pretends. The app
 *     falls back to typing the session code shown on the terminal, and that
 *     fallback is labelled as typing a code, not as NFC.
 */

let NfcManager = null;
let NfcTech = null;
let Ndef = null;

try {
  // Wrapped: in Expo Go or on a device without the native module this import
  // throws, and the app should still run with the rest of its features.
  const nfc = require('react-native-nfc-manager');
  NfcManager = nfc.default;
  NfcTech = nfc.NfcTech;
  Ndef = nfc.Ndef;
} catch (err) {
  NfcManager = null;
}

export const NFC_UNAVAILABLE =
  'This build cannot use NFC. Use a development build on a physical NFC phone, or type the code shown on the terminal.';

let started = false;

/** True only when a real NFC radio and the native module are both present. */
export async function isSupported() {
  if (!NfcManager) return false;
  try {
    return await NfcManager.isSupported();
  } catch (err) {
    return false;
  }
}

export async function isEnabled() {
  if (!NfcManager) return false;
  try {
    return await NfcManager.isEnabled();
  } catch (err) {
    return false;
  }
}

export async function start() {
  if (!NfcManager) throw new Error(NFC_UNAVAILABLE);
  if (started) return true;
  await NfcManager.start();
  started = true;
  return true;
}

/** Accepts `tappay://session/SESSION_ABC12345` or a bare `SESSION_ABC12345`. */
export function parseSessionPayload(text) {
  if (!text) return null;
  const value = String(text).trim();
  const match = value.match(/SESSION_[A-Z0-9]{4,16}/i);
  return match ? match[0].toUpperCase() : null;
}

function readNdefText(tag) {
  const records = tag?.ndefMessage || [];
  for (const record of records) {
    try {
      if (!Ndef) break;
      if (record.tnf === Ndef.TNF_WELL_KNOWN && Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
        const text = Ndef.text.decodePayload(record.payload);
        if (text) return text;
      }
      const uri = Ndef.uri.decodePayload(record.payload);
      if (uri) return uri;
    } catch (err) {
      // Try the next record.
    }
  }
  return null;
}

/**
 * Waits for the phone to be held against the terminal and returns the session
 * code the terminal is advertising. Cancel with `stop()`.
 */
export async function readSessionFromTerminal() {
  if (!NfcManager) throw new Error(NFC_UNAVAILABLE);
  await start();

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Hold your phone against the payment terminal',
    });
    const tag = await NfcManager.getTag();
    const sessionId = parseSessionPayload(readNdefText(tag));
    if (!sessionId) {
      throw new Error('That terminal did not send a TapPay payment session.');
    }
    return sessionId;
  } finally {
    await stop();
  }
}

export async function stop() {
  if (!NfcManager) return;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch (err) {
    // Nothing was in progress.
  }
}

export default {
  isSupported,
  isEnabled,
  start,
  stop,
  readSessionFromTerminal,
  parseSessionPayload,
  NFC_UNAVAILABLE,
};
