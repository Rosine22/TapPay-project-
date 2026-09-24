import { useEffect, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import * as api from '../services/api';
import { Button, Card, Field, Notice, styles } from '../components/Ui';
import { colors, money } from '../components/theme';

/** Accepts `tappay://pay/TP_XXXXXX` or a bare `TP_XXXXXX`. */
export function parsePaymentId(value) {
  if (!value) return null;
  const match = String(value).match(/TP_[A-Z0-9]{4,12}/i);
  return match ? match[0].toUpperCase() : null;
}

export default function SendByQR({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState('scan'); // scan → amount → sent
  const [receiver, setReceiver] = useState(null);
  const [digits, setDigits] = useState('');
  const [pin, setPin] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  async function identify(raw) {
    const paymentId = parsePaymentId(raw);
    if (!paymentId) {
      setError('That is not a TapPay code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await api.lookupPaymentId(paymentId);
      setReceiver(user);
      setStage('amount');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError('');
    try {
      await api.createPaymentRequest(receiver.paymentId, Number(digits), pin);
      setStage('sent');
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'sent') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.ink }}>Request sent</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>
            {receiver.name} has to approve before the money leaves your wallet. You can follow it in
            your transactions once it is approved.
          </Text>
        </Card>
        <Button title="Back to home" onPress={() => navigation.navigate('Dashboard')} />
      </ScrollView>
    );
  }

  if (stage === 'amount') {
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Text style={{ color: colors.muted }}>Sending to</Text>
            <Text style={[styles.h1, { marginTop: 2 }]}>{receiver.name}</Text>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>{receiver.paymentId}</Text>

            <Notice>{error}</Notice>

            <Field label="Amount in RWF">
              <TextInput
                style={[styles.input, { fontSize: 24, fontWeight: '700' }]}
                value={digits}
                onChangeText={(v) => setDigits(v.replace(/\D/g, '').slice(0, 9))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
              />
            </Field>
            {digits ? (
              <Text style={{ color: colors.muted, marginTop: -8, marginBottom: 12 }}>
                {money(digits)} RWF
              </Text>
            ) : null}

            <Field label="Your payment PIN">
              <TextInput
                style={[styles.input, { letterSpacing: 8, fontSize: 20 }]}
                value={pin}
                onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="••••"
                placeholderTextColor={colors.muted}
              />
            </Field>

            <Button
              title="Continue"
              onPress={send}
              busy={busy}
              disabled={!Number(digits) || pin.length < 4}
            />
            <Button title="Scan someone else" tone="quiet" style={{ marginTop: 10 }} onPress={() => setStage('scan')} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 18 }}>Scan their QR code</Text>
        <Text style={styles.h2}>Ask them to open My QR in TapPay.</Text>

        <Notice>{error}</Notice>

        <View style={{ height: 300, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ink }}>
          {permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : ({ data }) => identify(data)}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ color: '#fff', textAlign: 'center' }}>
                TapPay needs the camera to scan a QR code.
              </Text>
              <Button title="Allow camera" style={{ marginTop: 14 }} onPress={requestPermission} />
            </View>
          )}
        </View>
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.ink }}>Or type their TapPay ID</Text>
        <Text style={styles.h2}>Useful on a simulator, where there is no camera.</Text>
        <Field label="TapPay ID">
          <TextInput
            style={styles.input}
            value={manual}
            onChangeText={(v) => setManual(v.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            autoCapitalize="characters"
            placeholder="TP_ALICE7"
            placeholderTextColor={colors.muted}
          />
        </Field>
        <Button
          title="Find this person"
          tone="dark"
          onPress={() => identify(manual)}
          disabled={!parsePaymentId(manual)}
          busy={busy}
        />
      </Card>
    </ScrollView>
  );
}
