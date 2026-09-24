import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import * as api from '../services/api';
import { Card, Notice, styles } from '../components/Ui';
import { colors, money, shortDate } from '../components/theme';

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.getTransactions());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Notice>{error}</Notice>

      {items.length === 0 && !error && (
        <Card>
          <Text style={{ color: colors.muted }}>No payments yet. Tap to pay at a terminal to get started.</Text>
        </Card>
      )}

      <Card>
        {items.map((t, index) => {
          const out = t.direction === 'OUT';
          return (
            <View
              key={t.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 14,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.line,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{t.counterparty.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {t.method === 'NFC' ? 'Tap payment' : 'QR transfer'} · {shortDate(t.createdAt)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{t.reference}</Text>
              </View>
              <Text style={{ fontWeight: '700', color: out ? colors.ink : colors.go }}>
                {out ? '−' : '+'}
                {money(t.amount)}
              </Text>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}
