import { useState } from 'react';
import { login, me, saveToken } from '../services/api';

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState('merchant@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      const { token } = await login(email.trim(), password);
      saveToken(token);
      const user = await me();
      if (user.role !== 'MERCHANT') {
        setError('This terminal only accepts merchant accounts.');
        setBusy(false);
        return;
      }
      onSignedIn(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h1>Sign in to the terminal</h1>
      <h2>Use the merchant account for this till</h2>

      {error && <div className="notice">{error}</div>}

      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && signIn()}
        autoComplete="current-password"
      />

      <button className="primary" onClick={signIn} disabled={busy || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </div>
  );
}
