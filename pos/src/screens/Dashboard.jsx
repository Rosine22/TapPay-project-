import { useEffect, useState } from 'react';
import { merchantSummary, recentSessions } from '../services/api';
import { money, time } from '../components/format';

export default function Dashboard({ onNewPayment }) {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([merchantSummary(), recentSessions()])
      .then(([s, list]) => {
        setSummary(s);
        setSessions(list);
      })
      .catch((err) => setError(err.message));
  }, []);

  const paid = sessions.filter((s) => s.status === 'COMPLETED');

  return (
    <>
      <div className="panel">
        <h2>Taken today</h2>
        <div className="sales">
          {summary ? money(summary.todaysSales) : '—'} <small>RWF</small>
        </div>
        <p className="footnote">
          Wallet balance {summary ? `${money(summary.balance)} ${summary.currency}` : '—'}
        </p>
        <button className="primary" onClick={onNewPayment}>
          Charge a customer
        </button>
      </div>

      <div className="panel">
        <h2>Recent payments</h2>
        {error && <div className="notice">{error}</div>}
        {paid.length === 0 && <p className="footnote">Nothing yet today. Charge a customer to get started.</p>}
        <ul className="rows">
          {paid.map((s) => (
            <li key={s.sessionId}>
              <span>
                <span className="name">{s.customerName || 'Customer'}</span>
                <br />
                <span className="meta">
                  {s.transactionReference || s.sessionId} · {time(s.createdAt)}
                </span>
              </span>
              <span className="value">
                {money(s.amount)} {s.currency}
                <br />
                <span className="tag done">Paid</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
