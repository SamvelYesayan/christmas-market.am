import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, qs } from '../api/client.js';
import { useAsync } from '../lib.js';
import Art from '../art/Art.jsx';
import { Empty, GiftTag, Loader } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { useI18n } from '../i18n/index.jsx';

const PRICE_BANDS = [['', 'anyPrice'], ['0-10000', 'under10'], ['10000-25000', 'p10to25'], ['25000-50000', 'p25to50'], ['50000-', 'p50']];

export default function Shop() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const [cats] = useAsync(() => api.get('/categories'), []);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const filters = {
    q: params.get('q') ?? '',
    sort: params.get('sort') ?? 'popular',
    price: params.get('price') ?? '',
    onSale: params.get('onSale') ?? '',
    magic: params.get('magic') ?? '',
    limited: params.get('limited') ?? '',
  };
  const [min, max] = filters.price.split('-');
  const key = JSON.stringify([category, filters]);

  const [state] = useAsync(
    () => api.get(`/products${qs({ category, q: filters.q, sort: filters.sort, min, max, onSale: filters.onSale, magic: filters.magic, limited: filters.limited, page, limit: 24 })}`),
    [key, page],
  );
  useEffect(() => { setPage(1); setItems([]); }, [key]);
  useEffect(() => {
    if (state.data) setItems((prev) => (page === 1 ? state.data.products : [...prev, ...state.data.products]));
  }, [state.data, page]);

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const current = cats.data?.categories.find((c) => c.slug === category);
  useEffect(() => { document.title = `${current?.name ?? t('shop.title')} · ${t('brand.name')}`; }, [current, t]);

  return (
    <div className="shop">
      <header className="shop-head wrap">
        <div className="shop-head-text">
          <span className="eyebrow">{filters.q ? t('shop.whispered') : t('shop.street')}</span>
          <motion.h1 key={current?.slug ?? filters.q ?? 'all'} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {filters.q ? <>“<em>{filters.q}</em>”</> : current?.name ?? <>{t('shop.all1')} <em>{t('shop.all2')}</em></>}
          </motion.h1>
          <p className="muted">{current?.tagline ?? t('shop.intro')}</p>
        </div>
        {current && <div className="shop-head-art"><Art art={{ type: current.art, c1: current.color, c2: '#f2c46d' }} /></div>}
        <HiddenWonder id="silver-key" style={{ right: '3%', top: '10%' }} />
      </header>

      <nav className="stall-nav" aria-label={t('shop.categories')}>
        <Link to="/shop" className={`stall-pill ${!category ? 'on' : ''}`} style={{ '--c': '#f2c46d' }}>{t('shop.allStalls')}</Link>
        {cats.data?.categories.map((c) => (
          <Link key={c.slug} to={`/shop/${c.slug}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ''}`} className={`stall-pill ${category === c.slug ? 'on' : ''}`} style={{ '--c': c.color }}>
            <span className="stall-pill-art"><Art art={{ type: c.art, c1: c.color, c2: '#f2c46d' }} glow={false} /></span>{c.name}
          </Link>
        ))}
      </nav>

      <div className="wrap">
        <div className="filters" role="group" aria-label={t('shop.filters')}>
          <label className="filter-sort">
            <span className="label">{t('shop.sort')}</span>
            <select className="input" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="popular">{t('shop.popular')}</option>
              <option value="new">{t('shop.new')}</option>
              <option value="price_asc">{t('shop.priceAsc')}</option>
              <option value="price_desc">{t('shop.priceDesc')}</option>
              <option value="name">{t('shop.name')}</option>
            </select>
          </label>
          <div className="row">
            {PRICE_BANDS.map(([v, l]) => <button key={l} className={`chip ${filters.price === v ? 'on' : ''}`} onClick={() => set('price', v)}>{t(`shop.${l}`)}</button>)}
          </div>
          <div className="row">
            <button className={`chip ${filters.onSale ? 'on' : ''}`} onClick={() => set('onSale', filters.onSale ? '' : 'true')}>{t('shop.offers')}</button>
            <button className={`chip ${filters.magic ? 'on' : ''}`} onClick={() => set('magic', filters.magic ? '' : 'true')}>{t('shop.magical')}</button>
            <button className={`chip ${filters.limited ? 'on' : ''}`} onClick={() => set('limited', filters.limited ? '' : 'true')}>{t('shop.limited')}</button>
            {filters.q && <button className="chip" onClick={() => set('q', '')}>{t('shop.clear')}</button>}
          </div>
        </div>

        {state.error && <div className="form-error">{state.error.message}</div>}
        {state.loading && page === 1 ? <Loader label={t('shop.arranging')} /> : items.length === 0 ? (
          <Empty title={t('shop.empty')}>
            <p className="muted">{t('shop.emptyBody')}</p>
            <Link className="btn" to="/gift-finder">{t('shop.ask')}</Link>
          </Empty>
        ) : (
          <>
            <p className="muted result-count">{t('shop.found', { n: state.data?.total ?? items.length })}</p>
            <div className="tag-grid">{items.map((p, i) => <GiftTag key={p.slug} product={p} index={i} variant={i % 7 === 0 ? 'window' : 'tag'} />)}</div>
            {state.data && page < state.data.pages && (
              <div className="center" style={{ marginTop: '2.5rem' }}>
                <button className="btn btn-ghost" onClick={() => setPage(page + 1)} disabled={state.loading}>{state.loading ? t('shop.bringing') : t('shop.more')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
