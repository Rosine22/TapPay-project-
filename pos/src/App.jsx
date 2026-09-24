import { useEffect, useState } from 'react';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import NewPayment from './screens/NewPayment';
import PaymentStatus from './screens/PaymentStatus';
import { clearToken, hasToken, me } from './services/api';

/**
 * A till has four states, so the terminal keeps its own tiny router instead of
 * pulling in a routing library.
 */
export default function App() {
  const [merchant, setMerchant] = useState(null);
  const [screen, setScreen] = useState(hasToken() ? 'loading' : 'login');
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (screen !== 'loading') return;
    me()
      .then((user) => {
        setMerchant(user);
        setScreen('dashboard');
      })
      .catch(() => {
        clearToken();
        setScreen('login');
      });
  }, [screen]);

  function signOut() {
    clearToken();
    setMerchant(null);
    setSession(null);
    setScreen('login');
  }

  return (
    <div className="shell">
      <div className="terminal">
        <div className="bar">
          <div className="wordmark">
            Tap<span>Pay</span> terminal
          </div>
          {merchant && (
            <button className="who" style={{ background: 'none', padding: 0 }} onClick={signOut}>
              {merchant.name} · sign out
            </button>
          )}
        </div>

        {screen === 'loading' && <div className="panel">Loading…</div>}

        {screen === 'login' && (
          <Login
            onSignedIn={(user) => {
              setMerchant(user);
              setScreen('dashboard');
            }}
          />
        )}

        {screen === 'dashboard' && <Dashboard onNewPayment={() => setScreen('new')} />}

        {screen === 'new' && (
          <NewPayment
            onCancel={() => setScreen('dashboard')}
            onSessionOpen={(s) => {
              setSession(s);
              setScreen('status');
            }}
          />
        )}

        {screen === 'status' && session && (
          <PaymentStatus session={session} onDone={() => setScreen('new')} />
        )}
      </div>
    </div>
  );
}
