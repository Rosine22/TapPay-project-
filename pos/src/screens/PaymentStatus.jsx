import { useEffect, useRef, useState } from 'react';
import { getSession, cancelSession } from '../services/api';
import { money } from '../components/format';

const LABELS = {
  WAITING: 'Waiting for the customer to tap',
  AUTHORIZED: 'Authorising…',
  COMPLETED: 'Payment received',
  FAILED: 'Payment failed',
  EXPIRED: 'Session expired',
  CANCELLED: 'Cancelled',
};

/**
 * The terminal follows the session by polling the backend. The phone never
 * tells the terminal that a payment worked — only the backend does.
 */
export default function PaymentStatus({ session: initial, onDone }) {
  const [session, setSession] = useState(initial);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    async function poll() {
      try {
        const fresh = await getSession(initial.sessionId);
        setSession(fresh);
        if (fresh.status === 'WAITING' || fresh.status === 'AUTHORIZED') {
          timer.current = setTimeout(poll, 1500);
        }
      } catch (err) {
        setError(err.message);
        timer.current = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => clearTimeout(timer.current);
  }, [initial.sessionId]);

  const open = session.status === 'WAITING' || session.status === 'AUTHORIZED';
  const done = session.status === 'COMPLETED';
  const state = done ? 'done' : open ? 'waiting' : 'failed';

  async function cancel() {
    try {
      const cancelled = await cancelSession(session.sessionId);
      setSession(cancelled);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <div className="status">
        <span className={`dot ${state}`} />
        {LABELS[session.status]}
      </div>

      <div className="amount">
        {money(session.amount)} <small>{session.currency}</small>
      </div>

      {error && <div className="notice">{error}</div>}

      {open && (
        <div className="reader">
          Hold the phone against the reader
          <strong>Session {session.sessionId.replace('SESSION_', '')}</strong>
          <p className="footnote" style={{ marginTop: 10 }}>
            No NFC hardware on this machine? The customer can type this code into the app to pick
            up the same session.
          </p>
        </div>
      )}

      {!open && (
        <div className="result">
          <div className={`headline ${done ? 'done' : 'failed'}`}>
            {done ? 'Paid' : LABELS[session.status]}
          </div>
          {done && (
            <p className="footnote">
              {session.customerName} · {session.transactionReference}
            </p>
          )}
        </div>
      )}

      {open ? (
        <button className="ghost" onClick={cancel}>
          Cancel this charge
        </button>
      ) : (
        <button className="primary" onClick={onDone}>
          New charge
        </button>
      )}
    </div>
  );
}
