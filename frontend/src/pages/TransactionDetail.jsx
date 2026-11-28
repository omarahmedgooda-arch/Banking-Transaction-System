import { useParams } from 'react-router-dom';
import { get } from '../api';
import { Held, OtpPanel, Reasons } from '../components/Outcome';
import { ErrorCard, Skeleton, StatusBadge, TopBar, typeName, useLoader } from '../components/ui';
import { dateTime, egp } from '../format';
import { useL } from '../prefs';
import { localize } from '../serverText';

export default function TransactionDetail() {
  const L = useL();
  const { id } = useParams();
  const { data, error, loading, reload } = useLoader(() => get(`/api/transactions/${id}`), [id]);
  const tx = data?.transaction;
  const out = tx?.direction === 'OUT';

  if (tx && out && tx.status === 'PENDING_OTP') {
    return (
      <main className="page narrow">
        <TopBar title={L('Finish transfer', 'كمّل التحويل')} />
        <OtpPanel tx={tx} reasons={data.risk?.reasons} score={data.risk?.score} onFinish={() => reload()} />
      </main>
    );
  }
  if (tx && out && tx.status === 'PENDING_REVIEW') {
    return (
      <main className="page narrow">
        <TopBar title={L('Transfer details', 'تفاصيل التحويل')} />
        <Held tx={tx} reasons={data.risk?.reasons} score={data.risk?.score} />
      </main>
    );
  }

  return (
    <main className="page narrow">
      <TopBar title={L('Transaction', 'العملية')} />
      {loading && <Skeleton height={320} />}
      {error && <ErrorCard error={error} />}
      {tx && (
        <>
          <div className="stack" style={{ alignItems: 'center', gap: 6, padding: '12px 0' }}>
            <p className="small muted" dir="auto">{localize(tx.title)}</p>
            <p className={`num ${out ? '' : 'ok'}`} style={{ fontSize: 34, fontWeight: 700, textDecoration: tx.status === 'REJECTED' ? 'line-through' : undefined }}>
              {out ? '-' : '+'}{egp(tx.amount)}
            </p>
            <StatusBadge status={tx.status} />
          </div>
          <div className="card stack" style={{ gap: 12 }}>
            <Row k={L('Type', 'النوع')} v={typeName(tx)} />
            {data.fromAccount && <Row k={L('From', 'من')} v={data.fromAccount} />}
            {data.toAccount && <Row k={L('To', 'لـ')} v={data.toAccount} />}
            {out && Number(tx.fee) > 0 && <Row k={L('Fee', 'الرسوم')} v={egp(tx.fee)} />}
            {tx.note && tx.type === 'TRANSFER' && <Row k={L('Note', 'ملاحظة')} v={tx.note} />}
            <Row k={L('Date', 'التاريخ')} v={dateTime(tx.createdAt)} />
            <Row k={L('Reference', 'الرقم المرجعي')} v={tx.reference} />
          </div>
          {data.risk && data.risk.reasons.length > 0 && <Reasons reasons={data.risk.reasons} score={data.risk.score} />}
          {data.risk && data.risk.reasons.length === 0 && out && (
            <p className="tiny muted" style={{ textAlign: 'center' }}>{L('Fraud Guard checked this transfer: low risk.', 'Fraud Guard راجع التحويل ده: الخطر قليل.')}</p>
          )}
        </>
      )}
    </main>
  );
}

function Row({ k, v }) {
  return (
    <div className="between small">
      <span className="muted">{k}</span>
      <span className="num" style={{ textAlign: 'end' }}>{v}</span>
    </div>
  );
}
