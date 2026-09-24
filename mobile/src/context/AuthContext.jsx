import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  // The balance always comes from the server. Nothing in the app ever writes it.
  const refreshWallet = useCallback(async () => {
    const fresh = await api.getWallet();
    setWallet(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await api.loadToken();
        if (token) {
          setUser(await api.me());
          await refreshWallet();
        }
      } catch (err) {
        await api.setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshWallet]);

  const signIn = useCallback(async (email, password) => {
    const { token, user: signedIn } = await api.login(email, password);
    await api.setToken(token);
    setUser(signedIn);
    await refreshWallet();
  }, [refreshWallet]);

  const signUp = useCallback(async (payload) => {
    const { token, user: created } = await api.register(payload);
    await api.setToken(token);
    setUser(created);
    await refreshWallet();
  }, [refreshWallet]);

  const signOut = useCallback(async () => {
    await api.setToken(null);
    setUser(null);
    setWallet(null);
  }, []);

  const value = useMemo(
    () => ({ user, wallet, loading, signIn, signUp, signOut, refreshWallet }),
    [user, wallet, loading, signIn, signUp, signOut, refreshWallet]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
