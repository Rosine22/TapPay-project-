import { useState } from 'react';
import { createSession } from '../services/api';
import { money } from '../components/format';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

export default function NewPayment({ onSessionOpen, onCancel }) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amount = Number(digits || 0);

  function press(key) {
    setError('');
    if (key === '⌫') return setDigits((d) => d.slice(0, -1));
    if (digits.length >= 9) return undefined;
    return setDigits((d) => (d === '' && key === '00' ? '' : d + key));
  }

  async function request() {
    setBusy(true);
    try {
      const session = await createSession(amount);
      onSessionOpen(session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Amount to charge</h2>
      <div className="amount">
        {money(amount)} <small>RWF</small>
      </div>

      {error && <div className="notice">{error}</div>}

      <div className="keypad">
        {KEYS.map((key) => (
          <button key={key} onClick={() => press(key)} aria-label={key === '⌫' ? 'Delete last digit' : key}>
            {key}
          </button>
        ))}
      </div>

      <button className="primary" onClick={request} disabled={busy || amount <= 0}>
        {busy ? 'Opening…' : 'Request payment'}
      </button>
      <button className="ghost" style={{ marginTop: 10 }} onClick={onCancel}>
        Back
      </button>
    </div>
  );
}
