import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../components/theme';

import Login from '../screens/Login';
import Register from '../screens/Register';
import Dashboard from '../screens/Dashboard';
import TapToPay from '../screens/TapToPay';
import PaymentConfirmation from '../screens/PaymentConfirmation';
import SendByQR from '../screens/SendByQR';
import MyQR from '../screens/MyQR';
import PaymentRequests from '../screens/PaymentRequests';
import Transactions from '../screens/Transactions';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.page },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.page },
};

export default function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={Register} options={{ title: 'Create your wallet' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={Dashboard} options={{ headerShown: false }} />
            <Stack.Screen name="TapToPay" component={TapToPay} options={{ title: 'Tap to pay' }} />
            <Stack.Screen name="PaymentConfirmation" component={PaymentConfirmation} options={{ title: 'Confirm payment' }} />
            <Stack.Screen name="SendByQR" component={SendByQR} options={{ title: 'Send money' }} />
            <Stack.Screen name="MyQR" component={MyQR} options={{ title: 'My QR code' }} />
            <Stack.Screen name="PaymentRequests" component={PaymentRequests} options={{ title: 'Requests' }} />
            <Stack.Screen name="Transactions" component={Transactions} options={{ title: 'Transactions' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
