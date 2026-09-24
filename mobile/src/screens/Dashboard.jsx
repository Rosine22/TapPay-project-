import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { Card, styles } from '../components/Ui';
import { colors, money } from '../components/theme';

export default function Dashboard({ navigation }) {
  const { user, wallet, refreshWallet, signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await refreshWallet().catch(() => {});
    const requests = await api.receivedRequests().catch(() => []);
    setPending(requests.filter((r) => r.status === 'PENDING').length);
  }, [refreshWallet]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: 60 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <View>
          <Text style={styles.h1}>Hello, {user.name.split(' ')[0]}</Text>
          <Text style={{ color: colors.muted }}>{user.paymentId}</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={10}>
          <Text style={{ color: colors.muted }}>Sign out</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={{ color: colors.muted, marginBottom: 4 }}>Available balance</Text>
        <Text style={styles.amount}>
          {wallet ? money(wallet.balance) : '—'}
          <Text style={{ fontSize: 18, color: colors.muted }}> {wallet?.currency || 'RWF'}</Text>
        </Text>
      </Card>

      {/* The one action this app exists for, so it gets the whole width and the loud colour. */}
      <Pressable
        onPress={() => navigation.navigate('TapToPay')}
        style={({ pressed }) => [
          {
            backgroundColor: colors.signal,
            borderRadius: 20,
            paddingVertical: 34,
            paddingHorizontal: 20,
            marginBottom: 14,
          },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.signalInk, letterSpacing: -0.5 }}>
          Tap to pay
        </Text>
        <Text style={{ color: '#5B4A16', marginTop: 6, fontSize: 15 }}>
          Hold your phone against a payment terminal
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <Tile title="Send money" subtitle="Scan a QR code" onPress={() => navigation.navigate('SendByQR')} />
        <Tile title="My QR" subtitle="Get paid by a friend" onPress={() => navigation.navigate('MyQR')} />
      </View>

      <Pressable onPress={() => navigation.navigate('PaymentRequests')}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>Requests waiting for you</Text>
          <Text style={{ color: pending ? colors.stop : colors.muted, fontWeight: '700' }}>{pending}</Text>
        </Card>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Transactions')}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>Transactions</Text>
          <Text style={{ color: colors.muted }}>View all</Text>
        </Card>
      </Pressable>
    </ScrollView>
  );
}

function Tile({ title, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.9 }]}>
      <Card style={{ marginBottom: 0, minHeight: 104, justifyContent: 'center' }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text>
      </Card>
    </Pressable>
  );
}
