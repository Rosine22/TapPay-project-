import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, disabled, busy, tone = 'primary', style }) {
  const tones = {
    primary: [styles.primary, { backgroundColor: colors.signal }],
    dark: [styles.primary, { backgroundColor: colors.ink }],
    quiet: [styles.primary, styles.quiet],
  };
  const textTones = {
    primary: { color: colors.signalInk },
    dark: { color: '#fff' },
    quiet: { color: colors.muted },
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [...tones[tone], style, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      {busy ? <ActivityIndicator color={textTones[tone].color} /> : <Text style={[styles.buttonText, textTones[tone]]}>{title}</Text>}
    </Pressable>
  );
}

export function Notice({ children, tone = 'error' }) {
  if (!children) return null;
  return (
    <View style={[styles.notice, tone === 'success' && { backgroundColor: '#E6F5EE', borderColor: colors.go }]}>
      <Text style={{ color: tone === 'success' ? colors.go : colors.stop }}>{children}</Text>
    </View>
  );
}

export function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 14,
  },
  primary: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { color: colors.muted, marginBottom: 6, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: colors.ink,
  },
  notice: {
    backgroundColor: '#FBE9E7',
    borderColor: colors.stop,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  h2: { fontSize: 15, color: colors.muted, marginBottom: 14 },
  amount: { fontSize: 40, fontWeight: '700', color: colors.ink, letterSpacing: -1 },
});
