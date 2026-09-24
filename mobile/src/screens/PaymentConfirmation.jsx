import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Notice, styles } from '../components/Ui';
import { colors, money } from '../components/theme';

/**
 * Everything shown here comes from the backend session, not from the tap.
 * The phone sends only the session code and the PIN; the amount, the merchant
 * and the result are decided on the server.
 */
export default function PaymentConfirmation({ route, navigation }) {
  const { session } = route.params;
  const { refreshWallet } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const result = await api.authorizeSession(session.sessionId, pin);
      setReceipt(result);
      await refreshWallet().catch(() => {});
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.go, marginBottom: 6 }}>
            Payment successful
          </Text>
          <Text style={styles.amount}>
            {money(receipt.transaction.amount)}
            <Text style={{ fontSize: 18, color: colors.muted }}> {receipt.transaction.currency}</Text>
          </Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>Paid to {receipt.merchant.name}</Text>
          <Text style={{ color: colors.muted }}>Reference {receipt.transaction.reference}</Text>
          <Text style={{ color: colors.ink, marginTop: 12, fontWeight: '600' }}>
            New balance {money(receipt.balance)} RWF
          </Text>
        </Card>

        <Button title="Done" onPress={() => navigation.navigate('Dashboard')} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={{ color: colors.muted }}>You are paying</Text>
          <Text style={[styles.h1, { marginTop: 2 }]}>{session.merchantName}</Text>

          <View style={{ marginVertical: 18 }}>
            <Text style={styles.amount}>
              {money(session.amount)}
              <Text style={{ fontSize: 18, color: colors.muted }}> {session.currency}</Text>
            </Text>
          </View>

          <Notice>{error}</Notice>

          <Field label="Payment PIN">
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

          <Button title="Confirm payment" onPress={confirm} busy={busy} disabled={pin.length < 4} />
          <Button
            title="Cancel"
            tone="quiet"
            style={{ marginTop: 10 }}
            onPress={() => navigation.navigate('Dashboard')}
          />
        </Card>

        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
          Session {session.sessionId} · expires shortly
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
