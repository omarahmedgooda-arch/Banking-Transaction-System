import { useState } from 'react';
import { post } from '../../api';
import { useToast } from '../../components/Toast';
import { amount, dateTime } from '../../format';
import { localize } from '../../serverText';
import { useL } from '../../prefs';

/** Held transactions with the reasons the Fraud Guard flagged them, and approve / reject actions. */
export default function ReviewTable({ items, onChange }) {
  const L = useL();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const decide = async (id, action) => {
    setBusy(id);
    try {
      const r = await post(`/api/admin/reviews/${id}/${action}`);
      toast(localize(r.message), action === 'approve' ? 'ok' : 'bad');
      onChange();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) {
    return <p className="small muted" style={{ padding: '12px 0' }}>{L('Nothing waiting. Every transfer is either sent or stopped.', 'مفيش حاجة مستنية. كل التحويلات يا اتبعتت يا اتوقفت.')}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr><th>{L('Customer', 'العميل')}</th><th>{L('Amount', 'المبلغ')}</th><th>{L('Risk', 'الخطر')}</th><th>{L('Why', 'ليه')}</th><th style={{ textAlign: 'end' }}>{L('Decision', 'القرار')}</th></tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.transactionId}>
              <td>
                <p style={{ fontWeight: 500 }}>{r.customerName}</p>
                <p className="tiny muted">{dateTime(r.createdAt)} · {r.reference}</p>
              </td>
              <td className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {amount(r.amount)}
                <p className="tiny muted" style={{ fontWeight: 400 }}>{r.type === 'WITHDRAW' ? L('Withdrawal', 'سحب') : `${r.fromAccount} → ${r.toAccount}`}</p>
              </td>
              <td><span className="badge bad">{r.score}</span></td>
              <td className="muted" style={{ maxWidth: 280 }}>{r.reasons.map((x) => localize(x.reason)).join(' · ')}</td>
              <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                <button type="button" className="btn sm danger" disabled={busy === r.transactionId} onClick={() => decide(r.transactionId, 'reject')}>{L('Reject', 'رفض')}</button>{' '}
                <button type="button" className="btn sm primary" disabled={busy === r.transactionId} onClick={() => decide(r.transactionId, 'approve')}>{L('Approve', 'موافقة')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
