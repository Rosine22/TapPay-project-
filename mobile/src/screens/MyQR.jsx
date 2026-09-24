import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import * as api from '../services/api';
import { Card, Notice, styles } from '../components/Ui';
import { colors } from '../components/theme';

/**
 * The QR carries one thing: `tappay://pay/TP_XXXXXX`.
 * No balance, no token, no personal detail — anyone scanning it can only learn
 * the display name, and only while signed in to TapPay themselves.
 */
export default function MyQR() {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyQr().then(setQr).catch((err) => setError(err.message));
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
        <Notice>{error}</Notice>

        {!qr && !error && <ActivityIndicator color={colors.ink} />}

        {qr && (
          <>
            <View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 16 }}>
              <QRCode value={qr.payload} size={220} color={colors.ink} backgroundColor="#fff" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 20 }}>{qr.name}</Text>
            <Text style={{ color: colors.muted, letterSpacing: 2, marginTop: 4, fontSize: 16 }}>
              {qr.paymentId}
            </Text>
          </>
        )}
      </Card>

      <Text style={{ color: colors.muted, textAlign: 'center', paddingHorizontal: 20 }}>
        Show this to another TapPay user so they can send you money. Every transfer still waits for
        you to approve it.
      </Text>
    </ScrollView>
  );
}
