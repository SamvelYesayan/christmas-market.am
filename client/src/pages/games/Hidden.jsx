import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useApp } from '../../state/AppState.jsx';
import { useAsync } from '../../lib.js';
import { Loader, LoadError } from '../../components/Common.jsx';
import { GameFrame } from '../Games.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function Hidden() {
  const { user } = useApp();
  const { t } = useI18n();
  const [state, , reload] = useAsync(() => api.get('/hidden'), [user?.id]);
  if (state.loading) return <Loader />;
  if (state.error) return <GameFrame title={t('games.hidden.title')}><LoadError error={state.error} onRetry={reload} /></GameFrame>;
  const list = state.data?.objects ?? [];
  const found = list.filter((o) => o.found).length;
  return (
    <GameFrame title={t('games.hidden.title')}>
      <p className="muted">{t('games.hidden.intro')} {user ? t('games.hidden.count', { f: found, t: list.length }) : t('games.hidden.signIn')}</p>
      <div className="hidden-list">
        {list.map((o) => (
          <div key={o.key} className={`hidden-card ${o.found ? 'found' : ''}`}>
            <span className="hidden-icon" aria-hidden="true">{o.found ? '✦' : '?'}</span>
            <div>
              <h3>{o.found ? o.name : t('games.hidden.glimmer')}</h3>
              <p className="muted">{o.hint}</p>
              {!o.found && <Link className="link" to={o.location}>{t('games.hidden.search')}</Link>}
            </div>
            <span className="stardust">+{o.points} ✨</span>
          </div>
        ))}
      </div>
    </GameFrame>
  );
}
