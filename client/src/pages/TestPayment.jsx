// Development-only stand-in for a payment provider page. Clearly marked; no money moves.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { money, storage } from '../lib.js';
import { Loader } from '../components/Common.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function TestPayment() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/payments/test/${id}`).then(setData, setError); }, [id]);
  const decide = async (decision) => {
    setBusy(true);
    try {
      const r = await api.post(`/payments/test/${id}/decide`, { decision });
      const key = storage.get(`mc.order.${r.orderNumber}`);
      nav(`/order/${r.orderNumber}?returned=1${key ? `&key=${key}` : ''}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  if (error) return <div className="wrap narrow"><div className="form-error">{error.message}</div></div>;
  if (!data) return <Loader />;
  return (
    <div className="wrap narrow test-pay">
      <div className="ribbon-test">{t('testpay.banner')}</div>
      <div className="panel pad">
        <h1>{t('testpay.title')}</h1>
        <p>{t('testpay.line', { n: data.order.number, amount: money(data.payment.amount) })}</p>
        <p className="muted">{t('testpay.body')}</p>
        {data.payment.status === 'succeeded' ? <p className="form-ok">{t('testpay.already')}</p> : (
          <div className="row">
            <button className="btn btn-green" disabled={busy} onClick={() => decide('approve')}>{t('testpay.approve')}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => decide('decline')}>{t('testpay.decline')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
