import { useEffect, useState } from 'react'
import {
  ArrowRight, ShieldCheck, Search, Send, MessageCircle, MapPin, RotateCcw, Star,
  Repeat, HandHeart, Wallet, Gift, Tag, Recycle, GraduationCap, Globe, Sparkles, Check,
  ShoppingBag, Clock, Archive, UserRound, Building2, Sprout, ArrowLeft, Eye, EyeOff, Menu, X, ArrowUpRight,
} from 'lucide-react'
import * as S from './store'
import { Link, go, money, priceLabel, priceUnit, ItemArt, Reveal, Logo } from './ui'

const WAYS = [
  { k: 'Borrow', icon: Repeat, tone: 'green', text: 'Use it for a semester, then hand it back. No buying, no clutter.' },
  { k: 'Lend', icon: HandHeart, tone: 'slate', text: 'Keep ownership and help a junior get through first year.' },
  { k: 'Rent', icon: Wallet, tone: 'orange', text: 'Earn from the drafter that would otherwise sit in a cupboard.' },
  { k: 'Donate', icon: Gift, tone: 'peri', text: 'Graduating? Give your things a second life on campus.' },
]
const STEPS = [
  [Search, 'Post or search', 'List what you no longer need, or find what you do.'],
  [Tag, 'Select item', 'Filter by course, semester, price and condition.'],
  [Send, 'Send request', 'Pick a duration and say hello to the owner.'],
  [Check, 'Owner accepts', 'They confirm and propose a meet-up spot.'],
  [MessageCircle, 'Chat & decide', 'Settle the details in a private thread.'],
  [MapPin, 'Meet on campus', 'Library, canteen, hostel gate: somewhere safe.'],
  [RotateCcw, 'Return or complete', 'Rentals come back on time, sales close out.'],
  [Star, 'Rate the experience', 'Reviews build trust for the next exchange.'],
]
const LOOP = [
  [ShoppingBag, 'Buy', 'Students buy items for one course or semester.'],
  [Clock, 'Use', 'They need it for a few months at most.'],
  [Archive, 'Unused', 'Then it sits idle in a hostel room.'],
  [UserRound, 'Someone needs it', 'A junior goes out and buys the same thing new.'],
]
const WHY = [
  [GraduationCap, 'For students', ['Save money', 'Find items faster', 'Avoid unnecessary purchases', 'Connect with seniors and juniors']],
  [Building2, 'For campus', ['Encourage reuse', 'Reduce unused resources', 'Improve accessibility', 'Build a sharing culture']],
  [Sprout, 'For the planet', ['Extend product lifecycles', 'Reduce unnecessary consumption', 'Promote a circular campus economy']],
]
const MARQUEE = ['Mini drafters', 'Textbooks', 'PYQ books', 'Scientific calculators', 'Lab coats', 'Arduino kits', 'Set squares', 'Badminton racquets', 'Notes', 'Multimeters', 'Reference books', 'Drawing boards']

export default function Landing({ route }) {
  const [pub, setPub] = useState(null)
  const [menu, setMenu] = useState(false)
  useEffect(() => { S.fetchPublic().then(setPub).catch(() => setPub({ impact: null, items: [], students: 0 })) }, [])
  if (route === '/login' || route === '/join') return <AuthPage mode={route === '/join' ? 'register' : 'login'} />

  const imp = pub?.impact
  const items = pub?.items || []
  const scrollTo = (id) => (e) => { e.preventDefault(); setMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

  return (
    <div className="landing">
      <header className="lnav">
        <div className="wrap lnav-in">
          <Link to="/"><Logo /></Link>
          <nav className={menu ? 'open' : ''}>
            <a href="#how" onClick={scrollTo('how')}>How it works</a>
            <a href="#ways" onClick={scrollTo('ways')}>Ways to share</a>
            <a href="#impact" onClick={scrollTo('impact')}>Impact</a>
            <a href="#shelf" onClick={scrollTo('shelf')}>On the shelf</a>
            <span className="lnav-cta">
              <Link to="/login" className="btn ghost sm">Log in</Link>
              <Link to="/join" className="btn line sm">Open app <ArrowUpRight size={15} /></Link>
            </span>
          </nav>
          <button className="icon-btn lnav-burger" aria-label="Menu" onClick={() => setMenu(!menu)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <Reveal as="span" className="eyebrow"><i className="sq" /> Campus marketplace / verified students only</Reveal>
            <Reveal as="h1" delay={60}>Don’t buy<br />what your<br /><em>campus<br />already has.</em></Reveal>
            <Reveal as="p" className="lead" delay={120}>
              EcoShelf lets seniors pass on drafters, textbooks, calculators and lab gear to the juniors who need them next. Borrow, lend, rent, sell or donate, without anything leaving campus.
            </Reveal>
            <Reveal className="hero-ctas" delay={180}>
              <Link to="/join" className="btn accent lg">Start sharing <ArrowRight size={18} /></Link>
              <a href="#how" onClick={scrollTo('how')} className="btn line lg">See how it works</a>
            </Reveal>
          </div>

          <Reveal className="hero-visual" delay={150}>
            <div className="path">
              <div className="path-h"><span>ES / exchange path</span><span className="live"><i />Campus online</span></div>
              {[
                ['01', 'Senior', 'lists a first-year drafter', 'Listed', 'ok'],
                ['02', 'Junior', 'requests it for 7 days', 'Request', 'warn'],
                ['03', 'Meet-up', 'main library · 4:00 pm', 'Set', 'info'],
                ['04', 'Return', 'back on day 7 · rated 5/5', 'Reused', 'ok'],
              ].map(([n, t, d, tag, tone]) => (
                <div className="path-row" key={n}>
                  <span className="path-n">{n}</span>
                  <div><b>{t}</b><small>{d}</small></div>
                  <span className={'tag tag-' + tone}>{tag}</span>
                </div>
              ))}
              <div className="path-f"><span>Saved vs new</span><b>{imp?.saved ? money(imp.saved) : '₹842'} · {imp?.reused ? imp.co2 : '1.2'} kg CO₂</b></div>
            </div>
          </Reveal>
        </div>
        <div className="marquee" aria-hidden="true"><div className="marquee-track">{[...MARQUEE, ...MARQUEE].map((m, n) => <span key={n}>{m}<i>/</i></span>)}</div></div>
      </section>

      {/* PROBLEM */}
      <section className="sec">
        <div className="wrap">
          <Reveal className="sec-head">
            <span className="kicker">The campus problem</span>
            <h2>Useful things sit idle while someone else buys them new.</h2>
            <p>Every semester the same cycle repeats across first-year drawing, labs, projects and sports. There has never been a simple, trusted way to connect the two sides.</p>
          </Reveal>
          <div className="loop">
            {LOOP.map(([Icon, t, d], n) => (
              <Reveal className="loop-card" key={t} delay={n * 80}>
                <span className="loop-n">0{n + 1}</span>
                <span className="loop-ic"><Icon size={22} /></span>
                <h3>{t}</h3><p>{d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="equation">Unused resources <span>+</span> unmet student needs <span>=</span> <b>the problem EcoShelf solves</b></Reveal>
        </div>
      </section>

      {/* WAYS */}
      <section className="sec sec-tint" id="ways">
        <div className="wrap">
          <Reveal className="sec-head">
            <span className="kicker">One app, four ways to share</span>
            <h2>However you want to pass it on.</h2>
            <p>Plus a straight sale when you'd rather hand it over for good.</p>
          </Reveal>
          <div className="ways">
            {WAYS.map(({ k, icon: Icon, tone, text }, n) => (
              <Reveal className={'way tone-' + tone} key={k} delay={n * 80}>
                <span className="way-ic"><Icon size={26} /></span>
                <h3>{k}</h3><p>{text}</p>
                <Link to="/join" className="way-link">Get started <ArrowRight size={15} /></Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="sec" id="how">
        <div className="wrap">
          <Reveal className="sec-head">
            <span className="kicker">How EcoShelf works</span>
            <h2>Eight simple steps, all inside your campus.</h2>
          </Reveal>
          <ol className="howgrid">
            {STEPS.map(([Icon, t, d], n) => (
              <Reveal as="li" key={t} delay={(n % 4) * 70}>
                <div className="how-top"><span className="how-n">{String(n + 1).padStart(2, '0')}</span><Icon size={20} /></div>
                <h3>{t}</h3><p>{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* LIFECYCLE */}
      <section className="sec sec-dark">
        <div className="wrap life">
          <Reveal className="life-copy">
            <span className="kicker light">The lifecycle of one item</span>
            <h2>A first-year drafter, used three times over.</h2>
            <p>A senior finishes engineering drawing and lists the drafter. A junior finds it in seconds, rents it for the semester and returns it. Next year, it goes round again instead of a new one being bought.</p>
            <Link to="/join" className="btn accent">List something today <ArrowRight size={16} /></Link>
          </Reveal>
          <div className="life-track">
            {[['Unused', 'Sitting in a senior’s cupboard'], ['Listed', 'Posted on EcoShelf in a minute'], ['Shared', 'Rented by a junior who needs it'], ['Reused', 'Back in circulation, not landfill']].map(([t, d], n) => (
              <Reveal className="life-step" key={t} delay={n * 110}>
                <span className="life-dot">{n + 1}</span>
                <div><b>{t}</b><small>{d}</small></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACT */}
      <section className="sec" id="impact">
        <div className="wrap">
          <Reveal className="sec-head">
            <span className="kicker">Live campus impact</span>
            <h2>Every exchange counts, and we count every one.</h2>
            <p>These numbers update from real activity on the platform.</p>
          </Reveal>
          <div className="stats">
            {[[Recycle, imp?.reused ?? '—', 'resources reused'], [GraduationCap, imp?.students ?? '—', 'students served'], [Wallet, imp ? money(imp.saved) : '—', 'saved vs buying new'], [Globe, imp ? imp.co2 + ' kg' : '—', 'CO₂e avoided (est.)']].map(([Icon, v, l], n) => (
              <Reveal className="stat" key={l} delay={n * 80}><Icon size={22} /><b>{v}</b><span>{l}</span></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SHELF */}
      {items.length > 0 && (
        <section className="sec sec-tint" id="shelf">
          <div className="wrap">
            <Reveal className="sec-head row-head">
              <div><span className="kicker">Fresh on the shelf</span><h2>Available on campus right now.</h2></div>
              <Link to="/join" className="btn ghost">Browse everything <ArrowRight size={16} /></Link>
            </Reveal>
            <div className="shelf">
              {items.slice(0, 4).map((i, n) => (
                <Reveal key={i.id} delay={n * 70}>
                  <Link to="/join" className="pcard">
                    <div className="pcard-img"><ItemArt item={i} /><span className={'chip t-' + i.type}>{S.TYPES[i.type]}</span></div>
                    <div className="pcard-body"><h3>{i.title}</h3><p>{i.course} · {i.condition}</p>
                      <div className="pcard-foot"><span className="price">{priceLabel(i)}<small> {priceUnit(i)}</small></span>{i.originalPrice > 0 && <s>{money(i.originalPrice)} new</s>}</div></div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHY */}
      <section className="sec">
        <div className="wrap">
          <Reveal className="sec-head"><span className="kicker">Why students use EcoShelf</span><h2>Good for you, your campus and the planet.</h2></Reveal>
          <div className="why">
            {WHY.map(([Icon, t, list], n) => (
              <Reveal className="why-card" key={t} delay={n * 90}>
                <span className="why-ic"><Icon size={22} /></span><h3>{t}</h3>
                <ul>{list.map((x) => <li key={x}><Check size={15} />{x}</li>)}</ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap">
        <Reveal className="cta">
          <div className="cta-words">{['Borrow it.', 'Lend it.', 'Rent it.', 'Donate it.', 'Reuse it.'].map((w) => <span key={w}>{w}</span>)}</div>
          <h2>Keep the campus in circulation.</h2>
          <p>Join with your college email in under a minute.</p>
          <Link to="/join" className="btn accent lg">Create your account <ArrowRight size={18} /></Link>
        </Reveal>
      </section>

      <footer className="lfoot">
        <div className="wrap lfoot-in">
          <Logo />
          <p>Buy less. Reuse more. Keep the campus in circulation.</p>
          <span className="muted">A student project · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}

/* ---------- login / sign-up ---------- */
const DEMO = ['aarav@campus.edu', 'meera@campus.edu', 'rohan@campus.edu', 'admin@campus.edu']
function AuthPage({ mode }) {
  const [f, setF] = useState({ name: '', email: '', password: '', college: '', branch: '', year: 1 })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const login = mode === 'login'
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (login) await S.login(f.email, f.password)
      else await S.register(f)
      go('/')
    } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link to="/"><Logo light /></Link>
        <div className="auth-quote">
          <Sparkles size={22} />
          <h2>“Don’t buy what your campus already has.”</h2>
          <div className="auth-chips"><span>Borrow</span><span>Lend</span><span>Rent</span><span>Donate</span></div>
        </div>
        <ul className="auth-points">
          <li><ShieldCheck size={18} /> Only verified college emails can join</li>
          <li><MapPin size={18} /> Every exchange happens on campus</li>
          <li><Star size={18} /> Ratings keep everyone accountable</li>
        </ul>
      </aside>
      <main className="auth-main">
        <Link to="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
        <form className="auth-form" onSubmit={submit}>
          <h1>{login ? 'Welcome back' : 'Join your campus'}</h1>
          <p className="muted">{login ? 'Log in with your college email.' : 'Create a verified account with your college email.'}</p>
          {!login && <>
            <label className="field"><span>Full name</span><input required value={f.name} onChange={set('name')} placeholder="Your name" /></label>
            <label className="field"><span>College</span><input value={f.college} onChange={set('college')} placeholder="e.g. NIT Example" /></label>
            <div className="frow">
              <label className="field"><span>Branch</span><input value={f.branch} onChange={set('branch')} placeholder="e.g. Mechanical" /></label>
              <label className="field"><span>Year</span><select value={f.year} onChange={set('year')}>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</select></label>
            </div>
          </>}
          <label className="field"><span>College email</span><input type="email" required value={f.email} onChange={set('email')} placeholder="you@college.edu" autoComplete="email" /></label>
          <label className="field"><span>Password</span>
            <div className="pw"><input type={show ? 'text' : 'password'} required value={f.password} onChange={set('password')} placeholder={login ? 'Your password' : 'At least 6 characters'} autoComplete={login ? 'current-password' : 'new-password'} />
              <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          </label>
          {err && <p className="err">{err}</p>}
          <button className="btn dark lg block" disabled={busy}>{busy ? 'Please wait…' : login ? 'Log in' : 'Create account'} {!busy && <ArrowRight size={18} />}</button>
          <p className="swap">{login ? 'New to EcoShelf?' : 'Already have an account?'} <Link to={login ? '/join' : '/login'}>{login ? 'Create an account' : 'Log in'}</Link></p>
          {login && (
            <div className="demo">
              <span>Demo accounts · password <code>demo1234</code></span>
              <div>{DEMO.map((e) => <button type="button" key={e} onClick={() => setF({ ...f, email: e, password: 'demo1234' })}>{e.split('@')[0]}</button>)}</div>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
