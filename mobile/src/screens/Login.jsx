import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Notice, styles } from '../components/Ui';
import { colors } from '../components/theme';

export default function Login({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 80 }]}>
        <Text style={[styles.h1, { fontSize: 34 }]}>
          Tap<Text style={{ color: colors.signal }}>Pay</Text>
        </Text>
        <Text style={styles.h2}>Pay at the counter with a tap.</Text>

        <Card>
          <Notice>{error}</Notice>

          <Field label="Email">
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label="Password">
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your password"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
        </Card>

        <Pressable onPress={() => navigation.navigate('Register')} style={{ padding: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.ink, fontWeight: '600' }}>New here? Create a wallet</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
