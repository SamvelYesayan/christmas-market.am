import { Link } from 'react-router-dom';
import { Empty } from '../components/Common.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="wrap">
      <Empty art={{ type: 'lantern', c1: '#1b2a5c', c2: '#a9c7ff' }} title={t('notFound.title')}>
        <p className="muted">{t('notFound.body')}</p>
        <Link className="btn" to="/">{t('notFound.back')}</Link>
      </Empty>
    </div>
  );
}
