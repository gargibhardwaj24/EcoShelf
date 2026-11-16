// Shared UI primitives: routing, formatting, item artwork, stars, reveal-on-scroll.
import { useEffect, useRef, useState } from 'react'
import {
  Ruler, BookOpen, FileText, Calculator, FlaskConical, Wrench, Trophy, PenTool, Package, Star,
} from 'lucide-react'

export function useRoute() {
  const get = () => location.hash.slice(1) || '/'
  const [r, setR] = useState(get)
  useEffect(() => {
    const f = () => { setR(get()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export const go = (p) => { location.hash = p }
export const Link = ({ to, children, className, ...rest }) => <a href={'#' + to} className={className} {...rest}>{children}</a>

export const money = (n) => '₹' + Number(n).toLocaleString('en-IN')
export const priceLabel = (i) => i.type === 'sell' ? money(i.price) : i.type === 'rent' ? money(i.price) : 'Free'
export const priceUnit = (i) => i.type === 'rent' ? '/ week' : i.type === 'lend' ? 'to borrow' : i.type === 'donate' ? 'to keep' : ''
export const fmt = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
export const ago = (t) => {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}
export const initials = (name = '?') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

const CAT = {
  'Drafting Tools': [Ruler, '#EAF4EE', '#5FA382'], Textbooks: [BookOpen, '#FDEEDC', '#F2A65A'],
  'PYQ / Notes': [FileText, '#FFF6DF', '#D9A441'], Calculators: [Calculator, '#E7EEF7', '#3E5C74'],
  'Lab Equipment': [FlaskConical, '#EEEAF6', '#7E93B8'], 'Components & Tools': [Wrench, '#F1ECE5', '#9A7B5B'],
  Sports: [Trophy, '#FCE6DA', '#E0805A'], Stationery: [PenTool, '#F7E6EC', '#C46F8B'],
}
export const catIcon = (c) => (CAT[c] || [Package])[0]

export function ItemArt({ item, className = '' }) {
  if (item.image) return <img className={'art ' + className} src={item.image} alt={item.title} loading="lazy" />
  const [Icon, bg, fg] = CAT[item.category] || [Package, '#EEE', '#888']
  return (
    <div className={'art art-ph ' + className} style={{ '--bg': bg, '--fg': fg }} role="img" aria-label={item.title}>
      <Icon strokeWidth={1.4} />
    </div>
  )
}

export function Stars({ v = 0, n = 0, size = 14 }) {
  return (
    <span className="stars" title={n ? `${v.toFixed(1)} from ${n} reviews` : 'No reviews yet'}>
      {[1, 2, 3, 4, 5].map((k) => <Star key={k} size={size} className={k <= Math.round(v) ? 'on' : ''} />)}
      <small>{n ? `${v.toFixed(1)} · ${n}` : 'New'}</small>
    </span>
  )
}

export function Avatar({ name, size = 36 }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>
}

// adds .in when the element scrolls into view (CSS handles the animation)
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ transitionDelay: delay + 'ms' }} {...rest}>{children}</Tag>
}

export function Logo({ light }) {
  return (
    <span className={'logo' + (light ? ' light' : '')}>
      <span className="logo-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" fill="currentColor" /><path d="M5 19 13 11" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
      <span>Eco<b>Shelf</b></span>
    </span>
  )
}
