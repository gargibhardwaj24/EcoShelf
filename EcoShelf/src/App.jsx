import { useEffect, useState } from 'react'
import {
  Search, Plus, Bell, LogOut, ArrowRight, ArrowLeft, ShieldCheck, MapPin, Calendar, Clock, Flag, Pencil, Trash2,
  Inbox, Send, ImagePlus, X, SlidersHorizontal, Recycle, GraduationCap, Wallet, Globe, Package, Handshake,
  MessageCircle, Check, Star, Repeat, HandHeart, Gift, Tag, LayoutGrid, Leaf, Shield, Menu,
} from 'lucide-react'
import * as S from './store'
import { useRoute, go, Link, money, priceLabel, priceUnit, fmt, ago, ItemArt, Stars, Avatar, Logo, catIcon } from './ui'
import Landing from './Landing'
import './App.css'

const { useStore, currentUser, getUser, CATEGORIES, CONDITIONS, TYPES } = S
const TYPE_ICON = { sell: Tag, rent: Wallet, lend: Repeat, donate: Gift }
const STATUS = { available: 'Available', requested: 'Requested', rented: 'On loan', sold: 'Gone' }

export default function App() {
  const st = useStore()
  const route = useRoute()
  const user = currentUser(st)
  const [menu, setMenu] = useState(false)

  if (!st.ready) return <div className="boot"><Logo /></div>
  if (!user) return <Landing route={route} />

  const d = st.db
  const unread = d.notifications.filter((n) => !n.read).length
  const parts = route.split('/').filter(Boolean)
  const sec = parts[0] || ''
  let page
  switch (sec) {
    case 'item': page = <ItemPage d={d} user={user} id={parts[1]} />; break
    case 'new': page = <ListingForm user={user} />; break
    case 'edit': page = <ListingForm user={user} editId={parts[1]} d={d} />; break
    case 'my': page = <MyStuff d={d} user={user} />; break
    case 'requests': page = <Requests d={d} user={user} />; break
    case 'request': page = <RequestPage d={d} user={user} id={parts[1]} />; break
    case 'notifications': page = <Notifications d={d} />; break
    case 'impact': page = <Impact d={d} />; break
    case 'profile': page = <Profile d={d} id={parts[1] || user.id} me={user} />; break
    case 'admin': page = user.role === 'admin' ? <Admin d={d} /> : <Empty icon={Shield} title="Admins only" />; break
    default: page = <Browse d={d} user={user} />
  }
  const nav = [['', 'Browse', LayoutGrid], ['my', 'My listings', Package], ['requests', 'Requests', Handshake], ['impact', 'Impact', Leaf]]
  if (user.role === 'admin') nav.push(['admin', 'Moderation', Shield])
  const active = (k) => (k === '' ? ['', 'item'].includes(sec) : sec === k || (k === 'requests' && sec === 'request'))
  const pending = d.requests.filter((r) => r.ownerId === user.id && r.status === 'requested').length

  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link to="/"><Logo /></Link>
          <nav className={'mainnav' + (menu ? ' open' : '')} onClick={() => setMenu(false)}>
            {nav.map(([k, l, Icon]) => (
              <Link key={k} to={'/' + k} className={active(k) ? 'on' : ''}><Icon size={16} />{l}{k === 'requests' && pending > 0 && <em>{pending}</em>}</Link>
            ))}
          </nav>
          <div className="topbar-r">
            <Link to="/new" className="btn accent sm hide-sm"><Plus size={16} /> List an item</Link>
            <Link to="/notifications" className={'icon-btn' + (sec === 'notifications' ? ' on' : '')} aria-label="Notifications"><Bell size={19} />{unread > 0 && <i className="ping">{unread}</i>}</Link>
            <Link to="/profile" className="me" title={user.name}><Avatar name={user.name} size={34} /></Link>
            <button className="icon-btn hide-sm" onClick={() => { S.logout(); go('/') }} aria-label="Log out" title="Log out"><LogOut size={18} /></button>
            <button className="icon-btn show-sm" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {menu && <div className="mobile-extra wrap"><Link to="/new" className="btn accent block"><Plus size={16} /> List an item</Link><button className="btn ghost block" onClick={() => { S.logout(); go('/') }}><LogOut size={16} /> Log out</button></div>}
      </header>
      <main className="wrap page" key={sec}>{page}</main>
      <footer className="appfoot wrap"><Logo /><span>Buy less. Reuse more. Keep the campus in circulation.</span></footer>
    </div>
  )
}

/* ---------- shared bits ---------- */
function PageHead({ kicker, title, sub, children }) {
  return (
    <div className="phead">
      <div>{kicker && <span className="kicker">{kicker}</span>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="phead-act">{children}</div>}
    </div>
  )
}
function Empty({ icon: Icon = Inbox, title, text, children }) {
  return <div className="empty"><span><Icon size={26} /></span><h3>{title}</h3>{text && <p>{text}</p>}{children}</div>
}
const Chip = ({ type }) => { const I = TYPE_ICON[type]; return <span className={'chip t-' + type}><I size={12} />{TYPES[type]}</span> }

function ItemCard({ i, d }) {
  const seller = getUser(d, i.sellerId)
  const save = i.type === 'sell' && i.originalPrice > i.price ? Math.round((1 - i.price / i.originalPrice) * 100) : 0
  return (
    <Link to={`/item/${i.id}`} className="pcard">
      <div className="pcard-img"><ItemArt item={i} /><Chip type={i.type} />{i.status !== 'available' && <span className={'status s-' + i.status}>{STATUS[i.status]}</span>}</div>
      <div className="pcard-body">
        <h3>{i.title}</h3>
        <p>{i.course}{i.semester ? ` · Sem ${i.semester}` : ''} · {i.condition}</p>
        <div className="pcard-foot">
          <span className="price">{priceLabel(i)}<small> {priceUnit(i)}</small></span>
          {save > 0 && <span className="save">{save}% off new</span>}
        </div>
        <div className="pcard-seller"><Avatar name={seller?.name} size={22} /><span>{seller?.name}</span><time>{ago(i.createdAt)}</time></div>
      </div>
    </Link>
  )
}

/* ---------- browse ---------- */
const BLANK = { q: '', category: '', type: '', condition: '', semester: '', course: '', min: '', max: '', onlyAvail: true, sort: 'new' }
function Browse({ d, user }) {
  const [f, setF] = useState(BLANK)
  const [open, setOpen] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const q = f.q.toLowerCase()
  const items = d.items.filter((i) => i.status !== 'removed' &&
    (!q || `${i.title} ${i.course} ${i.description} ${i.category}`.toLowerCase().includes(q)) &&
    (!f.category || i.category === f.category) && (!f.type || i.type === f.type) &&
    (!f.condition || i.condition === f.condition) && (!f.semester || i.semester === Number(f.semester)) &&
    (!f.course || (i.course || '').toLowerCase().includes(f.course.toLowerCase())) &&
    (f.min === '' || i.price >= Number(f.min)) && (f.max === '' || i.price <= Number(f.max)) &&
    (!f.onlyAvail || ['available', 'requested'].includes(i.status)))
    .sort((a, b) => f.sort === 'low' ? a.price - b.price : f.sort === 'high' ? b.price - a.price : b.createdAt - a.createdAt)
  const nFilters = ['category', 'condition', 'semester', 'course', 'min', 'max'].filter((k) => f[k] !== '').length
  return (
    <>
      <section className="bhero">
        <div>
          <span className="kicker">Hi {user.name.split(' ')[0]} / browse campus</span>
          <h1>What do you need this semester?</h1>
          <div className="searchbar">
            <Search size={20} />
            <input placeholder="Search drafters, textbooks, calculators, courses…" value={f.q} onChange={set('q')} />
            <button className={'btn ghost sm' + (nFilters ? ' has' : '')} onClick={() => setOpen(!open)}><SlidersHorizontal size={16} /> Filters{nFilters > 0 && <em>{nFilters}</em>}</button>
          </div>
        </div>
      </section>

      <div className="cats">
        <button className={!f.category ? 'on' : ''} onClick={() => setF({ ...f, category: '' })}><LayoutGrid size={16} />All</button>
        {CATEGORIES.map((c) => { const I = catIcon(c); return <button key={c} className={f.category === c ? 'on' : ''} onClick={() => setF({ ...f, category: f.category === c ? '' : c })}><I size={16} />{c}</button> })}
      </div>

      {open && (
        <div className="filterpanel">
          <label className="field"><span>Condition</span><select value={f.condition} onChange={set('condition')}><option value="">Any</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>Semester</span><select value={f.semester} onChange={set('semester')}><option value="">Any</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Course</span><input placeholder="e.g. Graphics" value={f.course} onChange={set('course')} /></label>
          <label className="field"><span>Min price</span><input type="number" min="0" placeholder="₹0" value={f.min} onChange={set('min')} /></label>
          <label className="field"><span>Max price</span><input type="number" min="0" placeholder="Any" value={f.max} onChange={set('max')} /></label>
          <button className="btn link" onClick={() => setF({ ...BLANK, q: f.q, type: f.type })}>Clear filters</button>
        </div>
      )}

      <div className="toolbar">
        <div className="seg">
          <button className={!f.type ? 'on' : ''} onClick={() => setF({ ...f, type: '' })}>All</button>
          {Object.entries(TYPES).map(([k, v]) => <button key={k} className={f.type === k ? 'on' : ''} onClick={() => setF({ ...f, type: k })}>{v}</button>)}
        </div>
        <div className="toolbar-r">
          <label className="switch"><input type="checkbox" checked={f.onlyAvail} onChange={set('onlyAvail')} /><i />Available only</label>
          <select className="sort" value={f.sort} onChange={set('sort')}><option value="new">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
        </div>
      </div>

      <p className="count">{items.length} item{items.length !== 1 && 's'} on campus</p>
      {items.length ? <div className="grid">{items.map((i) => <ItemCard key={i.id} i={i} d={d} />)}</div>
        : <Empty icon={Search} title="Nothing matches yet" text="Try clearing a filter, or be the first to list it."><Link to="/new" className="btn dark sm"><Plus size={16} /> List an item</Link></Empty>}
    </>
  )
}

/* ---------- item page ---------- */
function ItemPage({ d, user, id }) {
  const i = d.items.find((x) => x.id === id)
  const [days, setDays] = useState(7)
  const [msg, setMsg] = useState('')
  const [reason, setReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!i || i.status === 'removed') return <Empty icon={Package} title="This listing is gone" text="It may have been removed or handed over."><Link to="/" className="btn dark sm">Back to browse</Link></Empty>
  const seller = getUser(d, i.sellerId)
  const mine = i.sellerId === user.id
  const rt = S.itemRating(d, i.id), sr = S.userRating(d, seller.id)
  const myReq = d.requests.find((r) => r.itemId === i.id && r.borrowerId === user.id && ['requested', 'accepted', 'active'].includes(r.status))
  const timed = i.type === 'rent' || i.type === 'lend'
  const canRequest = !mine && !myReq && ['available', 'requested'].includes(i.status)
  const cta = { sell: 'Request to buy', rent: 'Request to rent', lend: 'Request to borrow', donate: 'Request this item' }[i.type]
  const reviews = d.reviews.filter((v) => v.itemId === i.id && v.kind === 'item')
  const total = S.requestAmount(i, days)
  const request = async () => { setBusy(true); await S.createRequest(i.id, { days, message: msg }); setBusy(false) }
  return (
    <>
      <Link to="/" className="back"><ArrowLeft size={16} /> All items</Link>
      <div className="detail">
        <div className="detail-media">
          <ItemArt item={i} className="big" />
          <div className="detail-desc card">
            <h3>About this item</h3>
            <p>{i.description || 'No description provided.'}</p>
            <dl className="specs">
              <div><dt>Category</dt><dd>{i.category}</dd></div>
              <div><dt>Course</dt><dd>{i.course || '—'}</dd></div>
              <div><dt>Semester</dt><dd>{i.semester ? `Sem ${i.semester}` : 'Any'}</dd></div>
              <div><dt>Condition</dt><dd>{i.condition}</dd></div>
              <div><dt>Listed</dt><dd>{ago(i.createdAt)}</dd></div>
              <div><dt>New price</dt><dd>{i.originalPrice ? money(i.originalPrice) : '—'}</dd></div>
            </dl>
          </div>
          {reviews.length > 0 && <div className="card"><h3>Reviews</h3>{reviews.map((v) => <Review key={v.id} v={v} d={d} />)}</div>}
        </div>

        <aside className="buybox">
          <div className="card">
            <div className="bb-tags"><Chip type={i.type} /><span className={'status inline s-' + i.status}>{STATUS[i.status]}</span></div>
            <h1>{i.title}</h1>
            <Stars v={rt.avg} n={rt.count} />
            <div className="bb-price"><b>{priceLabel(i)}</b><span>{priceUnit(i)}</span>{i.originalPrice > 0 && <s>{money(i.originalPrice)} new</s>}</div>

            {mine ? (
              <div className="bb-actions">
                <Link to={`/edit/${i.id}`} className="btn ghost block"><Pencil size={16} /> Edit listing</Link>
                <button className="btn danger block" onClick={async () => { if (confirm('Remove this listing?')) { await S.deleteItem(i.id); go('/my') } }}><Trash2 size={16} /> Remove</button>
              </div>
            ) : myReq ? (
              <div className="callout"><Check size={18} /><div>You've already requested this.{' '}<Link to={`/request/${myReq.id}`}>Open request <ArrowRight size={14} /></Link></div></div>
            ) : canRequest ? (
              <div className="bb-form">
                {timed && (
                  <label className="field"><span>How long do you need it?</span>
                    <div className="stepper"><button type="button" onClick={() => setDays(Math.max(1, days - 1))}>−</button><input type="number" min="1" max="120" value={days} onChange={(e) => setDays(Math.min(120, Math.max(1, Number(e.target.value) || 1)))} /><span>days</span><button type="button" onClick={() => setDays(Math.min(120, days + 1))}>+</button></div>
                  </label>
                )}
                <label className="field"><span>Message to {seller.name.split(' ')[0]}</span><textarea rows="2" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hi! When could we meet?" /></label>
                {(i.type === 'rent' || i.type === 'sell') && <div className="total"><span>Total, paid at meet-up</span><b>{money(total)}</b></div>}
                <button className="btn dark lg block" disabled={busy} onClick={request}>{cta} <ArrowRight size={18} /></button>
              </div>
            ) : <div className="callout muted"><Clock size={18} /><div>Not available right now.</div></div>}

            <ul className="assure"><li><ShieldCheck size={15} /> Verified campus student</li><li><MapPin size={15} /> Exchange at a campus meet-up</li></ul>
          </div>

          <Link to={`/profile/${seller.id}`} className="card seller">
            <Avatar name={seller.name} size={46} />
            <div><b>{seller.name}</b><small>{seller.branch}{seller.year ? `, Year ${seller.year}` : ''}</small><Stars v={sr.avg} n={sr.count} size={12} /></div>
            <ArrowRight size={18} />
          </Link>

          {!mine && (reporting ? (
            <div className="card report">
              <label className="field"><span>What's wrong with this listing?</span><input autoFocus placeholder="Spam, unsafe item, wrong info…" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <div className="row-btns"><button className="btn ghost sm" onClick={() => setReporting(false)}>Cancel</button>
                <button className="btn dark sm" disabled={!reason.trim()} onClick={async () => { await S.reportItem(i.id, reason); setReporting(false); setReason(''); alert('Thanks, moderators will review it.') }}>Submit report</button></div>
            </div>
          ) : <button className="btn link report-link" onClick={() => setReporting(true)}><Flag size={14} /> Report this listing</button>)}
        </aside>
      </div>
    </>
  )
}
function Review({ v, d }) {
  const u = getUser(d, v.fromId)
  return <div className="review"><Avatar name={u?.name} size={30} /><div><div className="review-h"><b>{u?.name}</b><Stars v={v.rating} n={1} size={12} /></div>{v.feedback && <p>{v.feedback}</p>}</div></div>
}

/* ---------- create / edit listing ---------- */
function resizeImage(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(1, 900 / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => rej(new Error('Could not read that image.'))
    img.src = url
  })
}
function ListingForm({ user, editId, d }) {
  const ex = editId ? d.items.find((i) => i.id === editId) : null
  const [f, setF] = useState(ex || { title: '', category: CATEGORIES[0], course: '', semester: 1, condition: 'Good', type: 'rent', price: '', originalPrice: '', description: '', image: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (editId && (!ex || ex.sellerId !== user.id)) return <Empty title="Listing not found" />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const free = f.type === 'lend' || f.type === 'donate'
  const onFile = async (e) => {
    const file = e.target.files[0]; if (!file) return
    try { setF({ ...f, image: await resizeImage(file) }) } catch (x) { setErr(x.message) }
  }
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const data = { ...f, semester: Number(f.semester) || 0, price: free ? 0 : Math.max(0, Number(f.price) || 0), originalPrice: Math.max(0, Number(f.originalPrice) || 0) }
    if (!free && data.price <= 0) return setErr('Enter a price greater than 0.')
    setBusy(true)
    if (ex) { await S.updateItem(ex.id, data); go('/item/' + ex.id) } else { const nid = await S.createItem(data); if (nid) go('/item/' + nid) }
    setBusy(false)
  }
  const preview = { ...f, price: Number(f.price) || 0, originalPrice: Number(f.originalPrice) || 0, title: f.title || 'Your item title', course: f.course || 'Course', sellerId: user.id, status: 'available', createdAt: Date.now(), id: 'preview' }
  return (
    <>
      <PageHead kicker={ex ? 'Edit listing' : 'New listing'} title={ex ? 'Update your listing' : 'Give something a second life'} sub="Takes about a minute. Juniors will see it right away." />
      <form className="lform" onSubmit={submit}>
        <div className="lform-main">
          <section className="card">
            <h3 className="step-h"><span>1</span> How do you want to share it?</h3>
            <div className="typepick">{Object.entries(TYPES).map(([k, v]) => { const I = TYPE_ICON[k]; return (
              <button type="button" key={k} className={'tp t-' + k + (f.type === k ? ' on' : '')} onClick={() => setF({ ...f, type: k })}>
                <span className="tp-ic"><I size={18} /></span><b>{v}</b><small>{S.TYPE_HINT[k]}</small></button>) })}</div>
          </section>
          <section className="card">
            <h3 className="step-h"><span>2</span> Item details</h3>
            <label className="field"><span>Title</span><input required maxLength="120" value={f.title} onChange={set('title')} placeholder="e.g. Mini drafter + set squares" /></label>
            <div className="frow">
              <label className="field"><span>Category</span><select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>Condition</span><select value={f.condition} onChange={set('condition')}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <div className="frow">
              <label className="field"><span>Course</span><input required value={f.course} onChange={set('course')} placeholder="e.g. Engineering Graphics" /></label>
              <label className="field"><span>Semester</span><select value={f.semester} onChange={set('semester')}><option value="0">Any</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>
            <label className="field"><span>Description</span><textarea rows="4" required value={f.description} onChange={set('description')} placeholder="What's included, any wear, when you're free to meet…" /></label>
          </section>
          <section className="card">
            <h3 className="step-h"><span>3</span> Price & photo</h3>
            <div className="frow">
              {!free && <label className="field"><span>{f.type === 'rent' ? 'Rent per week' : 'Selling price'}</span><div className="money-in"><i>₹</i><input type="number" min="1" value={f.price} onChange={set('price')} placeholder="0" /></div></label>}
              <label className="field"><span>Original price when new <em>optional</em></span><div className="money-in"><i>₹</i><input type="number" min="0" value={f.originalPrice} onChange={set('originalPrice')} placeholder="Helps show savings" /></div></label>
            </div>
            {free && <p className="hint"><HandHeart size={15} /> {f.type === 'lend' ? 'Lending is free. The borrower returns it when done.' : 'Donations are free. Thank you for passing it on!'}</p>}
            <label className="upload">
              <input type="file" accept="image/*" onChange={onFile} />
              {f.image ? <img src={f.image} alt="preview" /> : <span><ImagePlus size={26} /><b>Add a photo</b><small>JPG or PNG. Listings with photos get more requests.</small></span>}
            </label>
            {f.image && <button type="button" className="btn link" onClick={() => setF({ ...f, image: '' })}><X size={14} /> Remove photo</button>}
          </section>
        </div>
        <aside className="lform-side">
          <span className="kicker">Live preview</span>
          <div className="preview-card"><ItemCard i={preview} d={d || { users: [user] }} /></div>
          {err && <p className="err">{err}</p>}
          <button className="btn dark lg block" disabled={busy}>{busy ? 'Saving…' : ex ? 'Save changes' : 'Publish listing'} <ArrowRight size={18} /></button>
          <p className="muted small center">You can edit or remove it any time.</p>
        </aside>
      </form>
    </>
  )
}

/* ---------- my listings ---------- */
function MyStuff({ d, user }) {
  const mine = d.items.filter((i) => i.sellerId === user.id && i.status !== 'removed')
  const live = mine.filter((i) => ['available', 'requested'].includes(i.status)).length
  return (
    <>
      <PageHead kicker="Your shelf" title="My listings" sub={`${mine.length} listed · ${live} available right now`}><Link to="/new" className="btn dark"><Plus size={16} /> New listing</Link></PageHead>
      {mine.length ? <div className="grid">{mine.map((i) => <ItemCard key={i.id} i={i} d={d} />)}</div>
        : <Empty icon={Package} title="Your shelf is empty" text="That old drafter is someone's savings. List it in a minute."><Link to="/new" className="btn dark sm"><Plus size={16} /> List your first item</Link></Empty>}
    </>
  )
}

/* ---------- requests ---------- */
const STAGE = { requested: 'Requested', accepted: 'Meet-up set', rented: 'On loan', 'return due': 'Return due', overdue: 'Overdue', returned: 'Returned', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' }
const stageCls = (s) => 'stage s-' + s.replace(' ', '')
function Requests({ d, user }) {
  const [tab, setTab] = useState('in')
  const inc = d.requests.filter((r) => r.ownerId === user.id), out = d.requests.filter((r) => r.borrowerId === user.id)
  const list = tab === 'in' ? inc : out
  return (
    <>
      <PageHead kicker="Exchanges" title="Requests & history" sub="Everything you've lent, borrowed, sold and received." />
      <div className="seg big">
        <button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>For my items <em>{inc.length}</em></button>
        <button className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>My requests <em>{out.length}</em></button>
      </div>
      {!list.length ? <Empty icon={Handshake} title="No requests yet" text={tab === 'in' ? 'When someone asks for your item, it shows up here.' : 'Find something you need and send a request.'}>{tab === 'out' && <Link to="/" className="btn dark sm">Browse items</Link>}</Empty> : (
        <div className="rlist">
          {list.map((r) => {
            const item = d.items.find((i) => i.id === r.itemId); const other = getUser(d, tab === 'in' ? r.borrowerId : r.ownerId)
            const stage = S.stageOf(r)
            return (
              <Link key={r.id} to={`/request/${r.id}`} className="rrow">
                <ItemArt item={item} className="thumb" />
                <div className="rrow-main"><b>{item.title}</b><span><Avatar name={other?.name} size={18} /> {tab === 'in' ? 'from' : 'owned by'} {other?.name} · {ago(r.createdAt)}</span></div>
                <div className="rrow-meta">{r.amount > 0 && <b>{money(r.amount)}</b>}<span className={stageCls(stage)}>{STAGE[stage]}</span></div>
                <ArrowRight size={18} className="chev" />
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
function Lifecycle({ r, item }) {
  const timed = item.type === 'rent' || item.type === 'lend'
  const steps = timed ? ['requested', 'accepted', 'rented', 'return due', 'returned'] : ['requested', 'accepted', 'completed']
  const cur = S.stageOf(r)
  const idx = Math.max(0, steps.indexOf(cur === 'overdue' ? 'return due' : cur))
  const dead = ['declined', 'cancelled'].includes(r.status)
  return (
    <ol className={'track' + (dead ? ' dead' : '')}>
      {steps.map((s, n) => {
        const cls = dead ? '' : n < idx || (n === idx && S.isCompleted(r)) ? 'done' : n === idx ? 'cur' : ''
        return <li key={s} className={cls}><span>{cls === 'done' ? <Check size={14} /> : n + 1}</span>{STAGE[s]}</li>
      })}
    </ol>
  )
}
function RequestPage({ d, user, id }) {
  const r = d.requests.find((x) => x.id === id)
  const [text, setText] = useState('')
  const [place, setPlace] = useState(S.MEETUP_SPOTS[0])
  const [time, setTime] = useState(() => new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  const [rating, setRating] = useState(5)
  const [fb, setFb] = useState('')
  if (!r || ![r.ownerId, r.borrowerId].includes(user.id)) return <Empty title="Request not found" />
  const item = d.items.find((i) => i.id === r.itemId)
  const owner = r.ownerId === user.id
  const other = getUser(d, owner ? r.borrowerId : r.ownerId)
  const stage = S.stageOf(r)
  const myReview = d.reviews.find((v) => v.requestId === r.id && v.fromId === user.id)
  const live = !['declined', 'cancelled'].includes(r.status)
  const timed = item.type === 'rent' || item.type === 'lend'
  return (
    <>
      <Link to="/requests" className="back"><ArrowLeft size={16} /> All requests</Link>
      <div className="reqpage">
        <div className="reqmain">
          <div className="card">
            <div className="req-head">
              <ItemArt item={item} className="thumb lg" />
              <div className="grow"><Chip type={item.type} /><h1><Link to={`/item/${item.id}`}>{item.title}</Link></h1>
                <span className="muted">{owner ? 'Requested by' : 'Owned by'} <Link to={`/profile/${other.id}`}>{other.name}</Link></span></div>
              <span className={stageCls(stage)}>{STAGE[stage]}</span>
            </div>
            <Lifecycle r={r} item={item} />
            <div className="facts">
              {r.amount > 0 && <div><Wallet size={17} /><span>Amount<b>{money(r.amount)}</b><small>paid at meet-up</small></span></div>}
              {r.days > 0 && <div><Calendar size={17} /><span>Duration<b>{r.days} days</b></span></div>}
              {r.meetup && <div><MapPin size={17} /><span>Meet-up<b>{r.meetup.place}</b><small>{fmt(r.meetup.time)}</small></span></div>}
              {r.endDate && <div><Clock size={17} /><span>Return by<b>{fmt(r.endDate)}</b></span></div>}
            </div>
          </div>

          {r.status === 'requested' && owner && (
            <div className="card action-card">
              <h3>Accept and set a campus meet-up</h3>
              <div className="frow">
                <label className="field"><span>Place</span><select value={place} onChange={(e) => setPlace(e.target.value)}>{S.MEETUP_SPOTS.map((p) => <option key={p}>{p}</option>)}</select></label>
                <label className="field"><span>When</span><input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} /></label>
              </div>
              <div className="row-btns"><button className="btn ghost" onClick={() => S.respondRequest(r.id, false)}>Decline</button>
                <button className="btn dark" onClick={() => S.respondRequest(r.id, true, { place, time: new Date(time).getTime() })}><Check size={16} /> Accept request</button></div>
            </div>
          )}
          {r.status === 'accepted' && owner && (
            <div className="card action-card"><h3>Met up and handed it over?</h3><p className="muted">{timed ? 'Confirming starts the rental clock.' : 'Confirming completes the exchange.'}</p>
              <button className="btn dark" onClick={() => S.confirmHandover(r.id)}><Handshake size={16} /> {timed ? 'Confirm handover' : 'Confirm handover & payment'}</button></div>
          )}
          {r.status === 'active' && owner && (
            <div className="card action-card"><h3>Got it back?</h3><p className="muted">Confirm once the item is returned to you.</p>
              <button className="btn dark" onClick={() => S.confirmReturn(r.id)}><Check size={16} /> Confirm return</button></div>
          )}
          {!owner && ['requested', 'accepted'].includes(r.status) && <button className="btn link danger-t" onClick={() => { if (confirm('Cancel this request?')) S.cancelRequest(r.id) }}><X size={14} /> Cancel request</button>}
          {S.isCompleted(r) && (myReview ? <div className="callout"><Star size={18} /><div>You rated this exchange {myReview.rating}/5. Thanks for building trust!</div></div> : (
            <div className="card action-card">
              <h3>How did it go?</h3><p className="muted">Rate {owner ? other.name : 'the item and owner'}.</p>
              <div className="starpick">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={n + ' stars'}><Star size={28} /></button>)}</div>
              <label className="field"><span>Feedback <em>optional</em></span><input value={fb} onChange={(e) => setFb(e.target.value)} placeholder="On time, item as described…" /></label>
              <button className="btn dark" onClick={() => S.submitReview(r.id, { rating, feedback: fb })}>Submit review</button>
            </div>
          ))}
        </div>

        <div className="card chat">
          <div className="chat-h"><Avatar name={other.name} size={36} /><div><b>{other.name}</b><small>{other.branch}</small></div><MessageCircle size={18} /></div>
          <div className="msgs">
            {!r.messages.length && <div className="chat-empty"><MessageCircle size={22} /><p>Say hi and agree on a time and place.</p></div>}
            {r.messages.map((m, n) => <div key={n} className={'msg' + (m.from === user.id ? ' me' : '')}><p>{m.text}</p><small>{ago(m.at)}</small></div>)}
          </div>
          {live && <form className="chat-in" onSubmit={(e) => { e.preventDefault(); S.sendMessage(r.id, text); setText('') }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" /><button className="icon-btn send" aria-label="Send" disabled={!text.trim()}><Send size={17} /></button></form>}
        </div>
      </div>
    </>
  )
}

/* ---------- notifications ---------- */
function Notifications({ d }) {
  const list = d.notifications
  useEffect(() => { if (list.some((n) => !n.read)) { const t = setTimeout(S.markNotificationsRead, 1500); return () => clearTimeout(t) } }, [list.length]) // eslint-disable-line
  return (
    <>
      <PageHead kicker="Inbox" title="Notifications" />
      {!list.length ? <Empty icon={Bell} title="You're all caught up" /> : (
        <div className="nlist">{list.map((n) => (
          <Link key={n.id} to={n.link || '/'} className={'nrow' + (n.read ? '' : ' unread')}><span className="n-ic"><Bell size={16} /></span><p>{n.text}</p><time>{ago(n.at)}</time></Link>
        ))}</div>
      )}
    </>
  )
}

/* ---------- impact ---------- */
function Impact({ d }) {
  const e = S.ecoStats(d)
  const cats = Object.entries(e.byCat).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...cats.map((c) => c[1]))
  const tiles = [[Recycle, e.reused, 'Resources reused', 'green'], [GraduationCap, e.students, 'Students served', 'slate'], [Wallet, money(e.saved), 'Saved vs buying new', 'orange'], [Globe, e.co2 + ' kg', 'CO₂e avoided (est.)', 'green'], [Package, e.listed, 'Items in circulation', 'slate'], [Handshake, e.active, 'On loan right now', 'orange']]
  return (
    <>
      <PageHead kicker="Eco impact dashboard" title="What your campus has saved" sub="Live from completed exchanges. Money saved is original price minus what students paid; CO₂ uses rough per-category estimates." />
      <div className="kpis">{tiles.map(([I, v, l, tone]) => <div className={'kpi tone-' + tone} key={l}><span><I size={20} /></span><b>{v}</b><small>{l}</small></div>)}</div>
      <div className="card">
        <h3>Reuse by category</h3>
        {!cats.length ? <p className="muted">Complete a first exchange to see this fill up.</p> : cats.map(([c, n]) => { const I = catIcon(c); return (
          <div className="hbar" key={c}><span><I size={16} />{c}</span><div><i style={{ width: (n / max) * 100 + '%' }} /></div><b>{n}</b></div>) })}
      </div>
    </>
  )
}

/* ---------- profile ---------- */
function Profile({ d, id, me }) {
  const u = getUser(d, id)
  if (!u) return <Empty title="User not found" />
  const r = S.userRating(d, u.id)
  const listed = d.items.filter((i) => i.sellerId === u.id && i.status !== 'removed')
  const rev = d.reviews.filter((v) => v.toId === u.id)
  return (
    <>
      <div className="profile">
        <div className="cover" />
        <div className="profile-in">
          <Avatar name={u.name} size={92} />
          <div className="grow">
            <h1>{u.name} <span className="verified"><ShieldCheck size={15} /> Verified</span>{u.role === 'admin' && <span className="chip t-sell">Admin</span>}</h1>
            <p className="muted">{u.branch}{u.year ? ` · Year ${u.year}` : ''} · {u.college}</p>
            <Stars v={r.avg} n={r.count} />
          </div>
          {u.id === me.id && <button className="btn ghost" onClick={() => { S.logout(); go('/') }}><LogOut size={16} /> Log out</button>}
        </div>
      </div>
      <h2 className="sub-h">Listings <span>{listed.length}</span></h2>
      {listed.length ? <div className="grid">{listed.map((i) => <ItemCard key={i.id} i={i} d={d} />)}</div> : <p className="muted">No listings yet.</p>}
      <h2 className="sub-h">Reviews <span>{rev.length}</span></h2>
      {rev.length ? <div className="card">{rev.map((v) => <Review key={v.id} v={v} d={d} />)}</div> : <p className="muted">No reviews yet.</p>}
    </>
  )
}

/* ---------- admin ---------- */
function Admin({ d }) {
  const open = d.reports.filter((x) => x.status === 'open')
  return (
    <>
      <PageHead kicker="Admin" title="Moderation queue" sub={`${open.length} open report${open.length !== 1 ? 's' : ''}`} />
      {!open.length ? <Empty icon={ShieldCheck} title="No open reports" text="The campus shelf is looking clean." /> : (
        <div className="rlist">{open.map((p) => { const it = d.items.find((i) => i.id === p.itemId); const by = getUser(d, p.reporterId)
          return (
            <div className="rrow static" key={p.id}>
              {it && <ItemArt item={it} className="thumb" />}
              <div className="rrow-main"><b>{it?.title}</b><span>“{p.reason}” · by {by?.name} · {ago(p.at)}</span></div>
              <div className="row-btns"><Link to={`/item/${p.itemId}`} className="btn ghost sm">View</Link>
                <button className="btn ghost sm" onClick={() => S.resolveReport(p.id, false)}>Dismiss</button>
                <button className="btn danger sm" onClick={() => S.resolveReport(p.id, true)}><Trash2 size={14} /> Remove</button></div>
            </div>) })}</div>
      )}
    </>
  )
}
