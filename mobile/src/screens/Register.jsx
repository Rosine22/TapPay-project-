import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Notice, styles } from '../components/Ui';
import { colors } from '../components/theme';

export default function Register() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', pin: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await signUp({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        pin: form.pin,
        role: 'CUSTOMER',
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const ready = form.name && form.email && form.password.length >= 8 && /^\d{4,6}$/.test(form.pin);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Notice>{error}</Notice>

          <Field label="Full name">
            <TextInput style={styles.input} value={form.name} onChangeText={set('name')} placeholder="Alice Uwase" placeholderTextColor={colors.muted} />
          </Field>

          <Field label="Email">
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={set('email')}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="alice@example.com"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label="Password (at least 8 characters)">
            <TextInput style={styles.input} value={form.password} onChangeText={set('password')} secureTextEntry />
          </Field>

          <Field label="Payment PIN (4 to 6 digits)">
            <TextInput
              style={styles.input}
              value={form.pin}
              onChangeText={(v) => set('pin')(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
            />
          </Field>

          <Text style={{ color: colors.muted, marginBottom: 14, fontSize: 13 }}>
            You will type this PIN to approve every payment. It is stored hashed and can never be read
            back, so keep it somewhere safe.
          </Text>

          <Button title="Create wallet" onPress={submit} busy={busy} disabled={!ready} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
