import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Notice, styles } from '../components/Ui';
import { colors, money, shortDate } from '../components/theme';

const TONE = { PENDING: colors.signal, APPROVED: colors.go, REJECTED: colors.muted, EXPIRED: colors.muted, FAILED: colors.stop };

/** Incoming QR transfers. Money only moves when the receiver approves here. */
export default function PaymentRequests() {
  const { refreshWallet } = useAuth();
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.receivedRequests(), api.sentRequests()]);
      setReceived(a);
      setSent(b);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function act(id, approve) {
    setBusyId(id);
    setError('');
    try {
      if (approve) await api.approveRequest(id);
      else await api.rejectRequest(id);
      await Promise.all([load(), refreshWallet().catch(() => {})]);
    } catch (err) {
      setError(err.message);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = received.filter((r) => r.status === 'PENDING');
  const history = [...received, ...sent]
    .filter((r) => r.status !== 'PENDING')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Notice>{error}</Notice>

      {pending.length === 0 && (
        <Card>
          <Text style={{ color: colors.muted }}>Nothing waiting for you right now.</Text>
        </Card>
      )}

      {pending.map((r) => (
        <Card key={r.id}>
          <Text style={{ color: colors.muted }}>{r.sender.name} wants to send you</Text>
          <Text style={[styles.amount, { marginVertical: 8 }]}>
            {money(r.amount)}
            <Text style={{ fontSize: 18, color: colors.muted }}> {r.currency}</Text>
          </Text>
          <Text style={{ color: colors.muted, marginBottom: 14 }}>{shortDate(r.createdAt)}</Text>

          <Button title="Approve" onPress={() => act(r.id, true)} busy={busyId === r.id} />
          <Button title="Reject" tone="quiet" style={{ marginTop: 10 }} onPress={() => act(r.id, false)} disabled={busyId === r.id} />
        </Card>
      ))}

      {history.length > 0 && (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 10 }}>Earlier requests</Text>
          {history.map((r) => (
            <View
              key={`${r.id}-${r.status}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink }}>{r.sender.name} → {r.receiver.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{shortDate(r.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{money(r.amount)}</Text>
                <Text style={{ color: TONE[r.status], fontSize: 12 }}>{r.status.toLowerCase()}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
