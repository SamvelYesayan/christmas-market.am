import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import Art from '../art/Art.jsx';
import { useAt } from './i18n.js';

const ART_TYPES = ['tree', 'ornament', 'star', 'snowflake', 'wreath', 'garland', 'lights', 'snowglobe', 'giftbox', 'teddy', 'lantern', 'sleigh', 'mug', 'book', 'scarf', 'candle', 'cookie', 'stocking', 'scroll', 'musicbox', 'wand', 'sweater', 'mittens', 'bell', 'hat', 'key', 'heart', 'moon'];
const ATTRS = {
  recipients: ['child', 'teen', 'partner', 'parent', 'grandparent', 'friend', 'colleague', 'self'],
  ages: ['kids', 'teens', 'adults', 'seniors'],
  interests: ['decor', 'cozy', 'magic', 'cooking', 'reading', 'fashion', 'games', 'music', 'outdoors', 'crafts'],
  personalities: ['dreamer', 'classic', 'playful', 'elegant', 'adventurous', 'cozy'],
  occasions: ['christmas', 'new_year', 'secret_santa', 'thank_you', 'family'],
  atmospheres: ['cozy', 'grand', 'enchanted', 'nordic'],
};

const EMPTY = {
  slug: '', name: '', subtitle: '', description: '', story: '', category_id: '', price: 0, sale_price: '',
  is_active: true, is_featured: false, is_limited: false, is_magic: false, is_personalizable: false,
  tags: [], attributes: {}, art: { type: 'giftbox', c1: '#c8102e', c2: '#f2c46d' },
  variants: [{ sku: '', name: 'Standard', options: {}, price_delta: 0, stock: 0, i18n: { hy: { name: 'Ստանդարտ' } } }], images: [], i18n: { hy: {} },
};

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

export default function ProductEditor() {
  const at = useAt();
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const { toast } = useApp();
  const [p, setP] = useState(isNew ? EMPTY : null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/admin/products/${id}`).then((r) => setP({ ...r.item, sale_price: r.item.sale_price ?? '', category_id: r.item.category_id ?? '' }));
  useEffect(() => {
    api.get('/admin/categories').then((r) => setCats(r.items));
    if (!isNew) load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <p className="muted">{at('Loading…')}</p>;

  const set = (k, v) => setP({ ...p, [k]: v });
  const hy = p.i18n?.hy ?? {};
  const setHy = (k, v) => setP({ ...p, i18n: { ...(p.i18n ?? {}), hy: { ...hy, [k]: v } } });
  const setVar = (i, k, v) => set('variants', p.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const toggleAttr = (group, v) => {
    const cur = p.attributes[group] ?? [];
    set('attributes', { ...p.attributes, [group]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        slug: p.slug, name: p.name, subtitle: p.subtitle || null, description: p.description, story: p.story || null,
        category_id: p.category_id === '' ? null : Number(p.category_id), price: Number(p.price), sale_price: p.sale_price === '' ? null : Number(p.sale_price),
        is_active: p.is_active, is_featured: p.is_featured, is_limited: p.is_limited, is_magic: p.is_magic, is_personalizable: p.is_personalizable,
        tags: p.tags, attributes: p.attributes, art: p.art, i18n: p.i18n ?? {},
        variants: p.variants.map((v, i) => ({ ...(v.id ? { id: v.id } : {}), sku: v.sku, name: v.name, options: typeof v.options === 'string' ? JSON.parse(v.options || '{}') : v.options ?? {}, price_delta: Number(v.price_delta) || 0, stock: Number(v.stock) || 0, sort: i, is_active: v.is_active ?? true, i18n: v.i18n ?? {} })),
      };
      if (isNew) {
        const r = await api.post('/admin/products', body);
        toast(at('Product created'), { icon: '🎁' });
        nav(`/admin/products/${r.id}`, { replace: true });
      } else {
        await api.put(`/admin/products/${id}`, body);
        toast(at('Product saved'), { icon: '✅' });
        load();
      }
    } catch (err) {
      setError(err instanceof SyntaxError ? new Error('A variant has invalid options JSON.') : err);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(at('Delete this product? Products with orders are archived instead.'))) return;
    const r = await api.del(`/admin/products/${id}`);
    toast(r.message ?? at('Delete'));
    nav('/admin/products');
  };
  const upload = async (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('images', f));
    try {
      await api.upload(`/admin/products/${id}/images`, fd);
      toast(at('Images uploaded'), { icon: '🖼' });
      load();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  const moveImage = async (i, dir) => {
    const ids = p.images.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.put(`/admin/products/${id}/images/order`, { ids });
    load();
  };

  return (
    <form className="admin-section" onSubmit={save}>
      <Link className="link" to="/admin/products">{at('← Products')}</Link>
      <header className="admin-head">
        <h1>{isNew ? at('New product') : (hy.name && document.documentElement.lang === 'hy' ? hy.name : p.name)}</h1>
        <div className="row">
          {!isNew && <Link className="btn btn-ghost btn-sm" to={`/product/${p.slug}`} target="_blank">{at('View in store')}</Link>}
          {!isNew && <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>{at('Delete')}</button>}
          <button className="btn btn-sm" disabled={busy}>{busy ? at('Saving…') : at('Save')}</button>
        </div>
      </header>
      {error && <div className="form-error">{error.message}</div>}
      <div className="admin-grid">
        <section className="admin-card wide">
          <h3>{at('Basics')}</h3>
          <div className="admin-form-grid">
            <div className="field"><label>{at('Name')}</label><input value={p.name} required onChange={(e) => setP({ ...p, name: e.target.value, slug: isNew && (!p.slug || p.slug === slugify(p.name)) ? slugify(e.target.value) : p.slug })} /></div>
            <div className="field"><label>{at('Slug (URL)')}</label><input value={p.slug} required pattern="[a-z0-9-]+" onChange={(e) => set('slug', e.target.value)} /></div>
            <div className="field wide"><label>{at('Subtitle')}</label><input value={p.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} /></div>
            <div className="field wide"><label>{at('Description')}</label><textarea rows={4} value={p.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div className="field wide"><label>{at('Story (shown in italics)')}</label><textarea rows={2} value={p.story ?? ''} onChange={(e) => set('story', e.target.value)} /></div>
            <div className="field"><label>{at('Category')}</label><select value={p.category_id} onChange={(e) => set('category_id', e.target.value)}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>{at('Tags (comma separated)')}</label><input value={p.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))} /></div>
            <div className="field"><label>{at('Price ֏')}</label><input type="number" min="0" value={p.price} onChange={(e) => set('price', e.target.value)} /></div>
            <div className="field"><label>{at('Sale price ֏ (discount)')}</label><input type="number" min="0" value={p.sale_price} onChange={(e) => set('sale_price', e.target.value)} /></div>
          </div>
          <div className="row">
            {[['is_active', 'Visible in store'], ['is_featured', 'Featured'], ['is_limited', 'Limited collection'], ['is_magic', 'Magical / Academy'], ['is_personalizable', 'Personalisable']].map(([k, l]) => (
              <label key={k} className="check"><input type="checkbox" checked={!!p[k]} onChange={(e) => set(k, e.target.checked)} /> {at(l)}</label>
            ))}
          </div>
        </section>

        <section className="admin-card wide">
          <h3>{at('Armenian content')}</h3>
          <div className="admin-form-grid">
            <div className="field"><label>{at('Name (Armenian)')}</label><input lang="hy" value={hy.name ?? ''} onChange={(e) => setHy('name', e.target.value)} /></div>
            <div className="field"><label>{at('Subtitle (Armenian)')}</label><input lang="hy" value={hy.subtitle ?? ''} onChange={(e) => setHy('subtitle', e.target.value)} /></div>
            <div className="field wide"><label>{at('Description (Armenian)')}</label><textarea lang="hy" rows={4} value={hy.description ?? ''} onChange={(e) => setHy('description', e.target.value)} /></div>
            <div className="field wide"><label>{at('Story (Armenian)')}</label><textarea lang="hy" rows={2} value={hy.story ?? ''} onChange={(e) => setHy('story', e.target.value)} /></div>
          </div>
        </section>

        <section className="admin-card">
          <h3>{at('Illustration')}</h3>
          <p className="muted small">{at('Used when no photo is uploaded, and for thumbnails.')}</p>
          <div className="art-preview"><Art art={p.art} /></div>
          <div className="admin-form-grid">
            <div className="field"><label>{at('Type')}</label><select value={p.art.type} onChange={(e) => set('art', { ...p.art, type: e.target.value })}>{ART_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>{at('Colour 1')}</label><input type="color" value={p.art.c1 ?? '#c8102e'} onChange={(e) => set('art', { ...p.art, c1: e.target.value })} /></div>
            <div className="field"><label>{at('Colour 2')}</label><input type="color" value={p.art.c2 ?? '#f2c46d'} onChange={(e) => set('art', { ...p.art, c2: e.target.value })} /></div>
          </div>
        </section>

        <section className="admin-card">
          <h3>{at('Photos')}</h3>
          {isNew ? <p className="muted">{at('Save the product first, then upload photos.')}</p> : (
            <>
              <div className="thumbs">
                {p.images.map((img, i) => (
                  <figure key={img.id}>
                    <img src={img.url} alt={img.alt ?? ''} />
                    <figcaption>
                      <button type="button" onClick={() => moveImage(i, -1)} aria-label={at('Move left')}>←</button>
                      <button type="button" onClick={() => moveImage(i, 1)} aria-label={at('Move right')}>→</button>
                      <button type="button" className="danger" onClick={async () => { if (window.confirm(at('Delete image?'))) { await api.del(`/admin/products/${id}/images/${img.id}`); load(); } }}>✕</button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <label className="btn btn-ghost btn-sm upload-btn">{at('Upload images')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => e.target.files.length && upload(e.target.files)} /></label>
              <p className="muted small">{at('JPEG, PNG, WebP or AVIF · up to 5 MB each · first image is the cover.')}</p>
            </>
          )}
        </section>

        <section className="admin-card wide">
          <h3>{at('Variants & stock')}</h3>
          <div className="table-wrap"><table className="admin-table compact">
            <thead><tr><th>{at('SKU')}</th><th>{at('Name')}</th><th>{at('Variant name (hy)')}</th><th>{at('Options (JSON)')}</th><th>{at('Price +/−')}</th><th>{at('Stock')}</th><th>{at('Active')}</th><th /></tr></thead>
            <tbody>{p.variants.map((v, i) => (
              <tr key={v.id ?? `new-${i}`}>
                <td><input value={v.sku} required onChange={(e) => setVar(i, 'sku', e.target.value.toUpperCase())} /></td>
                <td><input value={v.name} required onChange={(e) => setVar(i, 'name', e.target.value)} /></td>
                <td><input lang="hy" value={v.i18n?.hy?.name ?? ''} onChange={(e) => setVar(i, 'i18n', { ...(v.i18n ?? {}), hy: { name: e.target.value } })} /></td>
                <td><input className="mono" value={typeof v.options === 'string' ? v.options : JSON.stringify(v.options ?? {})} onChange={(e) => setVar(i, 'options', e.target.value)} /></td>
                <td><input type="number" value={v.price_delta} onChange={(e) => setVar(i, 'price_delta', e.target.value)} /></td>
                <td><input type="number" min="0" value={v.stock} onChange={(e) => setVar(i, 'stock', e.target.value)} /></td>
                <td><input type="checkbox" checked={v.is_active ?? true} onChange={(e) => setVar(i, 'is_active', e.target.checked)} /></td>
                <td><button type="button" className="link danger" disabled={p.variants.length === 1} onClick={() => set('variants', p.variants.filter((_, j) => j !== i))}>{at('Remove')}</button></td>
              </tr>))}</tbody>
          </table></div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('variants', [...p.variants, { sku: `${p.slug.toUpperCase().replace(/-/g, '').slice(0, 10)}-${String(p.variants.length + 1).padStart(2, '0')}`, name: '', options: {}, price_delta: 0, stock: 0 }])}>{at('+ Add variant')}</button>
        </section>

        <section className="admin-card wide">
          <h3>{at('Gift Compass matching')}</h3>
          <p className="muted small">{at('These tags power the Gift Finder and personal recommendations.')}</p>
          {Object.entries(ATTRS).map(([group, values]) => (
            <div key={group} className="attr-row"><b>{at(group)}</b><div className="row">{values.map((v) => <button type="button" key={v} className={`chip ${(p.attributes[group] ?? []).includes(v) ? 'on' : ''}`} onClick={() => toggleAttr(group, v)}>{v}</button>)}</div></div>
          ))}
        </section>
      </div>
    </form>
  );
}
