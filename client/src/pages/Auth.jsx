import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../state/AppState.jsx';
import Art from '../art/Art.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function Auth({ mode }) {
  const { login, register, persona, user } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next') : '/account';
  const [f, setF] = useState({ name: persona?.name && persona.name !== 'Traveller' ? persona.name : '', email: '', password: '', personalizationConsent: !!persona?.welcomed, marketingConsent: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';
  useEffect(() => { document.title = `${isLogin ? t('auth.signInTitle') : t('auth.registerTitle')} · ${t('brand.name')}`; }, [isLogin, t]);
  useEffect(() => { if (user) nav(next, { replace: true }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login(f.email, f.password);
      else await register({ name: f.name, email: f.email, password: f.password, personalizationConsent: f.personalizationConsent, marketingConsent: f.marketingConsent });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="wrap auth">
      <motion.div className="auth-art" initial={{ opacity: 0, rotate: -10 }} animate={{ opacity: 1, rotate: 0 }}><Art art={{ type: 'lantern', c1: '#1b2a5c', c2: '#f2c46d' }} /></motion.div>
      <motion.form className="panel pad auth-card" onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <span className="eyebrow">{isLogin ? t('auth.door') : t('auth.newCottage')}</span>
        <h1>{isLogin ? <>{t('auth.welcomeA')} <em>{t('auth.welcomeB')}</em></> : <>{t('auth.lightA')} <em>{t('auth.lightB')}</em></>}</h1>
        {!isLogin && <p className="muted">{t('auth.keeps')}</p>}
        {error && <div className="form-error" role="alert">{error.message}</div>}
        {!isLogin && <div className="field"><label htmlFor="an">{t('auth.name')}</label><input id="an" autoComplete="name" value={f.name} onChange={set('name')} required maxLength={80} /></div>}
        <div className="field"><label htmlFor="ae">{t('auth.email')}</label><input id="ae" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></div>
        <div className="field"><label htmlFor="ap">{t('auth.password')}</label><input id="ap" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? 1 : 10} value={f.password} onChange={set('password')} required />{!isLogin && <span className="hint">{t('auth.pwHint')}</span>}</div>
        {!isLogin && (
          <div className="stack" style={{ gap: '0.6rem', marginBottom: '1rem' }}>
            <label className="check"><input type="checkbox" checked={f.personalizationConsent} onChange={set('personalizationConsent')} /> {t('auth.personalise')}</label>
            <label className="check"><input type="checkbox" checked={f.marketingConsent} onChange={set('marketingConsent')} /> {t('auth.letters')}</label>
          </div>
        )}
        <button className="btn btn-block" disabled={busy}>{busy ? t('auth.opening') : isLogin ? t('common.signIn') : t('auth.create')}</button>
        <p className="center muted" style={{ marginTop: '1rem' }}>
          {isLogin ? <>{t('auth.newHere')} <Link className="link" to={`/register?next=${encodeURIComponent(next)}`}>{t('auth.createLink')}</Link></> : <>{t('auth.have')} <Link className="link" to={`/login?next=${encodeURIComponent(next)}`}>{t('common.signIn')}</Link></>}
        </p>
      </motion.form>
    </div>
  );
}
