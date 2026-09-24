import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import * as api from '../services/api';
import nfc from '../services/nfcService';
import { Button, Card, Field, Notice, styles } from '../components/Ui';
import { colors } from '../components/theme';

/**
 * Two ways to pick up a payment session:
 *
 *   - NFC: hold the phone against the terminal and read the session code from it.
 *   - Typed code: read the code off the terminal screen and type it in.
 *
 * The second one is a fallback for builds or devices without NFC. It is labelled
 * as typing a code, because that is what it is. Both paths end in exactly the
 * same place: the backend session, the confirmation screen and the PIN.
 */
export default function TapToPay({ navigation }) {
  const [nfcReady, setNfcReady] = useState(null); // null = still checking
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = await nfc.isSupported();
      const enabled = supported ? await nfc.isEnabled() : false;
      if (alive) setNfcReady(supported && enabled);
    })();
    return () => {
      alive = false;
      nfc.stop();
    };
  }, []);

  async function openSession(sessionId) {
    setBusy(true);
    setError('');
    try {
      const session = await api.getSession(sessionId);
      if (session.status !== 'WAITING') {
        setError(`That payment is ${session.status.toLowerCase()}. Ask the cashier to start a new one.`);
        return;
      }
      navigation.replace('PaymentConfirmation', { session });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setScanning(false);
    }
  }

  async function tap() {
    setError('');
    setScanning(true);
    try {
      const sessionId = await nfc.readSessionFromTerminal();
      await openSession(sessionId);
    } catch (err) {
      setError(err.message);
      setScanning(false);
    }
  }

  const typed = nfc.parseSessionPayload(code) || nfc.parseSessionPayload(`SESSION_${code}`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.h1}>Hold your phone to the terminal</Text>
        <Text style={styles.h2}>
          The terminal sends only a payment code. Your PIN, your balance and your account stay on
          your phone and on the TapPay server.
        </Text>

        <Notice>{error}</Notice>

        <View
          style={{
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.line,
            borderRadius: 16,
            paddingVertical: 34,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 40 }}>{scanning ? '📡' : '📱'}</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            {scanning ? 'Listening for the terminal…' : 'Ready when you are'}
          </Text>
        </View>

        {nfcReady === null && <Text style={{ color: colors.muted }}>Checking this phone's NFC…</Text>}

        {nfcReady === true && (
          <Button title={scanning ? 'Cancel' : 'Start NFC'} tone={scanning ? 'quiet' : 'primary'} onPress={scanning ? () => { nfc.stop(); setScanning(false); } : tap} busy={busy} />
        )}

        {nfcReady === false && (
          <Text style={{ color: colors.muted }}>
            NFC is not available in this build or is switched off on this phone. Turn NFC on, or use
            the payment code below. The README explains what a build needs for NFC to work.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 2 }}>Type the payment code</Text>
        <Text style={styles.h2}>
          Not NFC — this is the code printed on the terminal screen. It reaches the same payment.
        </Text>

        <Field label="Code shown on the terminal">
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            autoCapitalize="characters"
            placeholder="8F42K9AB"
            placeholderTextColor={colors.muted}
          />
        </Field>

        <Button title="Continue" tone="dark" onPress={() => openSession(typed)} disabled={!typed} busy={busy} />
      </Card>
    </ScrollView>
  );
}
