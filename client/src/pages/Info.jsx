import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

// Placeholder policy texts (in i18n dictionaries) — replace with the store's reviewed legal copy before launch.
const TOPICS = ['delivery', 'privacy', 'terms'];

export default function Info() {
  const { topic } = useParams();
  const { t } = useI18n();
  if (!TOPICS.includes(topic)) return <div className="wrap"><h1>{t('info.notFound')}</h1><Link to="/">{t('info.home')}</Link></div>;
  const body = t(`info.${topic}.body`);
  return (
    <div className="wrap narrow">
      <header className="page-head"><span className="eyebrow">{t('info.help')}</span><h1>{t(`info.${topic}.title`)}</h1></header>
      <div className="panel pad prose">{body.map((p, i) => <p key={i}>{p}</p>)}</div>
    </div>
  );
}
