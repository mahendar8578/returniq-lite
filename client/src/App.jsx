import { useEffect, useState, useCallback } from 'react';
import { api, REASONS } from './api';

const TABS = ['Overview', 'Returns', 'Products', 'Settings'];
const today = () => new Date().toISOString().slice(0, 10);

function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => api.get(path).then(d => { setData(d); setError(''); }).catch(e => setError(e.message)), [path]);
  useEffect(() => { reload(); }, [reload]);
  return [data, reload, error];
}

export default function App() {
  const [tab, setTab] = useState('Overview');
  const [toast, setToast] = useState(null);
  const notify = (text, type = 'ok') => { setToast({ text, type }); setTimeout(() => setToast(null), 4500); };
  return (
    <div className="app">
      <header>
        <h1>ReturnIQ <span>Lite</span></h1>
        <nav>{TABS.map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
      </header>
      <main>
        {tab === 'Overview' && <Overview />}
        {tab === 'Returns' && <Returns notify={notify} />}
        {tab === 'Products' && <Products notify={notify} />}
        {tab === 'Settings' && <Settings notify={notify} />}
      </main>
      {toast && <div className={'toast ' + toast.type} role="alert">{toast.text}</div>}
    </div>
  );
}

const Err = ({ msg }) => msg ? <p className="err" role="alert">{msg}</p> : null;

function Overview() {
  const [sum, , e1] = useLoad('/analytics/summary');
  const [flagged, , e2] = useLoad('/analytics/flagged');
  const [trends, , e3] = useLoad('/analytics/trends');
  if (e1 || e2 || e3) return <Err msg={e1 || e2 || e3} />;
  if (!sum || !flagged || !trends) return <p>Loading…</p>;
  const maxReason = Math.max(1, ...sum.byReason.map(r => r.units));
  const maxMonth = Math.max(1, ...trends.map(m => m.total));
  return (<>
    <section className="stats">
      <div><b>{sum.overallRate}%</b>overall return rate</div>
      <div><b>{sum.totalReturned}</b>units returned</div>
      <div className={sum.flaggedCount ? 'alert' : ''}><b>{sum.flaggedCount}</b>products above {sum.threshold}%</div>
    </section>

    <section className="panel">
      <h2>Products to investigate</h2>
      {flagged.products.length === 0 ? <p className="muted">No product is above the {flagged.threshold}% threshold.</p> :
        <div className="scroll"><table><thead><tr><th>Product</th><th>Supplier</th><th>Returned / sold</th><th>Rate</th></tr></thead><tbody>
          {flagged.products.map(p => <tr key={p._id}><td>{p.name} <small>{p.sku}</small></td><td>{p.supplier}</td><td>{p.returned} / {p.unitsSold}</td><td className="flag">{p.rate}%</td></tr>)}
        </tbody></table></div>}
    </section>

    <div className="two">
      <section className="panel"><h2>Why items come back</h2>
        {sum.byReason.length === 0 && <p className="muted">Log a return to see reasons.</p>}
        {sum.byReason.map(r => <Bar key={r.reason} label={r.reason} value={r.units} pct={r.units / maxReason * 100} />)}
      </section>
      <section className="panel"><h2>Returns by month</h2>
        {trends.length === 0 && <p className="muted">No trend data yet.</p>}
        {trends.map(m => <Bar key={m.month} label={m.month} value={m.total} pct={m.total / maxMonth * 100}
          title={Object.entries(m.reasons).map(([k, v]) => `${k}: ${v}`).join(', ')} />)}
      </section>
    </div>

    <section className="panel"><h2>Supplier return rates</h2>
      <div className="scroll"><table><thead><tr><th>Supplier</th><th>Products</th><th>Returned / sold</th><th>Rate</th></tr></thead><tbody>
        {sum.suppliers.map(s => <tr key={s.supplier}><td>{s.supplier}</td><td>{s.products}</td><td>{s.returned} / {s.sold}</td><td className={s.rate > sum.threshold ? 'flag' : ''}>{s.rate}%</td></tr>)}
      </tbody></table></div>
    </section>
  </>);
}

const Bar = ({ label, value, pct, title }) => (
  <div className="bar" title={title}><span>{label}</span><i><u style={{ width: pct + '%' }} /></i><em>{value}</em></div>
);

function Products({ notify }) {
  const [data, reload, err] = useLoad('/analytics/products');
  const empty = { name: '', sku: '', supplier: '', unitsSold: '' };
  const [f, setF] = useState(empty);
  const [editing, setEditing] = useState(null);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    try {
      const body = { ...f, unitsSold: f.unitsSold === '' ? '' : Number(f.unitsSold) };
      editing ? await api.put('/products/' + editing, body) : await api.post('/products', body);
      notify(editing ? 'Product updated' : 'Product added'); setF(empty); setEditing(null); reload();
    } catch (x) { notify(x.message, 'err'); }
  };
  const remove = async p => {
    if (!confirm(`Delete ${p.name} and all its returns?`)) return;
    try { await api.del('/products/' + p._id); notify('Product deleted'); reload(); } catch (x) { notify(x.message, 'err'); }
  };
  return (<>
    <form className="panel form" onSubmit={submit}>
      <h2>{editing ? 'Edit product' : 'Add a product'}</h2>
      <label>Name<input value={f.name} onChange={set('name')} maxLength={100} required /></label>
      <label>SKU<input value={f.sku} onChange={set('sku')} maxLength={40} required /></label>
      <label>Supplier<input value={f.supplier} onChange={set('supplier')} maxLength={100} required /></label>
      <label>Units sold<input type="number" min="0" step="1" value={f.unitsSold} onChange={set('unitsSold')} required /></label>
      <div className="actions"><button className="primary">{editing ? 'Save changes' : 'Add product'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setF(empty); }}>Cancel</button>}</div>
    </form>
    <section className="panel"><h2>Product records</h2><Err msg={err} />
      {data && data.stats.length === 0 && <p className="muted">No products yet. Add one above.</p>}
      <div className="scroll"><table><thead><tr><th>Product</th><th>Supplier</th><th>Sold</th><th>Returned</th><th>Rate</th><th /></tr></thead><tbody>
        {data?.stats.map(p => <tr key={p._id} className={p.flagged ? 'hot' : ''}>
          <td>{p.name} <small>{p.sku}</small></td><td>{p.supplier}</td><td>{p.unitsSold}</td><td>{p.returned}</td>
          <td className={p.flagged ? 'flag' : ''}>{p.rate}%{p.flagged && ' ⚑'}</td>
          <td className="row-actions"><button onClick={() => { setEditing(p._id); setF({ name: p.name, sku: p.sku, supplier: p.supplier, unitsSold: p.unitsSold }); window.scrollTo(0, 0); }}>Edit</button>
            <button className="danger" onClick={() => remove(p)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </section>
  </>);
}

function Returns({ notify }) {
  const [products] = useLoad('/products');
  const [filter, setFilter] = useState({ reason: '', product: '' });
  const qs = '/returns?' + new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
  const [list, reload, err] = useLoad(qs);
  const empty = { product: '', reason: REASONS[0], quantity: 1, returnDate: today(), notes: '' };
  const [f, setF] = useState(empty);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    try { await api.post('/returns', { ...f, quantity: Number(f.quantity) }); notify('Return logged'); setF({ ...empty, product: f.product }); reload(); }
    catch (x) { notify(x.message, 'err'); }
  };
  const remove = async r => { try { await api.del('/returns/' + r._id); notify('Return deleted'); reload(); } catch (x) { notify(x.message, 'err'); } };
  return (<>
    <form className="panel form" onSubmit={submit}>
      <h2>Log a return</h2>
      <label>Product<select value={f.product} onChange={set('product')} required>
        <option value="">Choose…</option>{products?.map(p => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}</select></label>
      <label>Reason<select value={f.reason} onChange={set('reason')}>{REASONS.map(r => <option key={r}>{r}</option>)}</select></label>
      <label>Quantity<input type="number" min="1" step="1" value={f.quantity} onChange={set('quantity')} required /></label>
      <label>Date<input type="date" max={today()} value={f.returnDate} onChange={set('returnDate')} /></label>
      <label className="wide">Notes<input value={f.notes} onChange={set('notes')} maxLength={500} placeholder="Optional" /></label>
      <div className="actions"><button className="primary">Log return</button></div>
    </form>
    <section className="panel"><h2>Return log</h2>
      <div className="filters">
        <select aria-label="Filter by reason" value={filter.reason} onChange={e => setFilter({ ...filter, reason: e.target.value })}><option value="">All reasons</option>{REASONS.map(r => <option key={r}>{r}</option>)}</select>
        <select aria-label="Filter by product" value={filter.product} onChange={e => setFilter({ ...filter, product: e.target.value })}><option value="">All products</option>{products?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
      </div>
      <Err msg={err} />
      {list && list.length === 0 && <p className="muted">No returns match. Log one above.</p>}
      <div className="scroll"><table><thead><tr><th>Date</th><th>Product</th><th>Reason</th><th>Qty</th><th>Notes</th><th /></tr></thead><tbody>
        {list?.map(r => <tr key={r._id}><td>{r.returnDate.slice(0, 10)}</td><td>{r.product?.name || 'Deleted product'}</td><td>{r.reason}</td><td>{r.quantity}</td><td>{r.notes}</td>
          <td className="row-actions"><button className="danger" onClick={() => remove(r)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </section>
  </>);
}

function Settings({ notify }) {
  const [s, , err] = useLoad('/settings');
  const [val, setVal] = useState('');
  useEffect(() => { if (s) setVal(s.threshold); }, [s]);
  const save = async e => {
    e.preventDefault();
    try { await api.put('/settings', { threshold: val === '' ? '' : Number(val) }); notify('Threshold saved'); }
    catch (x) { notify(x.message, 'err'); }
  };
  return (
    <form className="panel form" onSubmit={save}>
      <h2>Flag threshold</h2><Err msg={err} />
      <p className="muted wide">A product is flagged when returned units divided by units sold is above this percentage.</p>
      <label>Return rate threshold (%)<input type="number" min="0" max="100" step="0.1" value={val} onChange={e => setVal(e.target.value)} required /></label>
      <div className="actions"><button className="primary">Save threshold</button></div>
    </form>
  );
}
