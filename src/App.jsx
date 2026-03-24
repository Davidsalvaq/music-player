import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ParticleBackground from './components/ParticleBackground'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Home from './pages/Home'
import Library from './pages/Library'
import Player from './pages/Player'
import Settings from './pages/Settings'
import Login from './pages/Login'
import UserProfile from './pages/UserProfile'
import ProtectedRoute from './components/ProtectedRoute'
import MiniPlayer from './components/MiniPlayer'
import { supabase } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import { Home as HomeIcon, Library as LibraryIcon, Play as PlayIcon, Settings as SettingsIcon } from 'lucide-react'

const PAGE_LABELS = { home: 'INICIO', library: 'BIBLIOTECA', player: 'REPRODUCTOR', settings: 'AJUSTES' }

function CreditsWord({ text, delay }) {
  return (
    <span className="credits-name">
      <motion.span
        style={{ display: 'block' }}
        initial={{ y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: [0.86, 0, 0.07, 1], delay }}
      >
        {text}
      </motion.span>
    </span>
  )
}

function NavLabel({ text, clickKey, loadDelay }) {
  return (
    <motion.span style={{ display: 'block', overflow: 'hidden' }}>
      <motion.span
        key={clickKey}
        style={{ display: 'block' }}
        initial={{ y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.65, ease: [0.86, 0, 0.07, 1], delay: clickKey === 0 ? loadDelay : 0 }}
      >
        {text}
      </motion.span>
    </motion.span>
  )
}

function TopNav({ onSearch, setActive }) {
  const { profile, user } = useAuth()
  const navigate = useNavigate()

  const goProfile = () => {
    setActive('settings')
  }

  const initial = profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <div className="top-nav-global">
      <button className="top-nav-search" onClick={onSearch} title="Buscar usuarios">⌕</button>
      {user && (
        <button 
          className="top-nav-profile"
          onClick={goProfile}
          title="Mi Perfil"
          style={{ backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none' }}
        >
          {!profile?.avatar_url && initial}
        </button>
      )}
    </div>
  )
}

function RightNav({ active, setActive }) {
  const links = ['HOME', 'LIBRARY', 'PLAYER', 'SETTINGS']
  const [clickKeys, setClickKeys] = useState({ HOME: 0, LIBRARY: 0, PLAYER: 0, SETTINGS: 0 })

  const handleClick = (link) => {
    setActive(link.toLowerCase())
    setClickKeys(prev => ({ ...prev, [link]: prev[link] + 1 }))
  }

  return (
    <motion.nav
      className="right-nav"
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.86, 0, 0.07, 1] }}
    >
      {links.map((link, i) => (
        <button
          key={link}
          className={`right-nav-link ${active === link.toLowerCase() ? 'nav-active' : ''}`}
          onClick={() => handleClick(link)}
        >
          <NavLabel text={link} clickKey={clickKeys[link]} loadDelay={0.4 + i * 0.10} />
        </button>
      ))}
    </motion.nav>
  )
}

function UserSearchModal({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const navigate = useNavigate()
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, username, avatar_url, bio')
        .ilike('username', `%${query}%`).limit(8)
      setResults(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const go = (username) => { onClose(); navigate(`/user/${username}`) }

  return (
    <>
      <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="edit-modal user-search-modal" initial={{ opacity: 0, scale: 0.92, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2 }}>
        <p className="modal-label">BUSCAR USUARIOS</p>
        <input
          ref={inputRef}
          className="login-input"
          type="text"
          placeholder="@USERNAME"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="search-results">
          {results.length === 0 && query.trim() && (
            <p style={{ opacity: 0.4, fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.85rem', padding: '0.5rem 0' }}>Sin resultados.</p>
          )}
          {results.map(p => (
            <button key={p.id} className="search-result-item" onClick={() => go(p.username)}>
              <div className="search-result-avatar" style={{ backgroundImage: p.avatar_url ? `url(${p.avatar_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: p.avatar_url ? 'transparent' : 'inherit' }}>
                {!p.avatar_url && p.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>@{p.username}</p>
                {p.bio && <p style={{ opacity: 0.5, fontSize: '0.75rem', fontFamily: "'Space Grotesk', sans-serif" }}>{p.bio.slice(0, 50)}{p.bio.length > 50 ? '...' : ''}</p>}
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  )
}

function CursorGlow() {
  const elRef = useRef(null)
  const rafRef = useRef(null)
  const posRef = useRef({ x: -200, y: -200 })

  useEffect(() => {
    const move = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY }
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (elRef.current) {
            elRef.current.style.left = posRef.current.x + 'px'
            elRef.current.style.top  = posRef.current.y + 'px'
            elRef.current.style.opacity = '1'
          }
          rafRef.current = null
        })
      }
    }
    window.addEventListener('mousemove', move, { passive: true })
    return () => {
      window.removeEventListener('mousemove', move)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <div ref={elRef} className="cursor-glow" style={{ opacity: 0 }} />
}


function MobileNav({ active, setActive }) {
  const links = [
    { key: 'home', icon: <HomeIcon size={20} strokeWidth={2.5} />, label: 'INICIO' },
    { key: 'library', icon: <LibraryIcon size={20} strokeWidth={2.5} />, label: 'BIBLIOTECA' },
    { key: 'player', icon: <PlayIcon size={20} strokeWidth={2.5} />, label: 'REPRODUCTOR' },
    { key: 'settings', icon: <SettingsIcon size={20} strokeWidth={2.5} />, label: 'AJUSTES' }
  ]
  return (
    <nav className="mobile-nav">
      {links.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`mobile-nav-btn ${active === key ? 'mobile-nav-active' : ''}`}
          onClick={() => setActive(key)}
        >
          <span className="mobile-nav-icon">{icon}</span>
          <span className="mobile-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}

const renderPage = (active, setActive, monospaced, setMonospaced) => {
  switch (active) {
    case 'home': return <Home setActive={setActive} />
    case 'library': return <Library setActive={setActive} />
    case 'player': return <Player setActive={setActive} />
    case 'settings': return <Settings setActive={setActive} monospaced={monospaced} setMonospaced={setMonospaced} />
    default: return <Home setActive={setActive} />
  }
}

function Layout() {
  const [active, setActive] = useState('home')
  const [monospaced, setMonospaced] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div className="app-shell">
      <CursorGlow />
      <ParticleBackground monospaced={monospaced} />

      <TopNav onSearch={() => setShowSearch(true)} setActive={setActive} />

      {/* Bottom-left: page breadcrumb + credits — only on Home */}
      {active === 'home' && (
        <motion.aside
          className="left-credits mobile-hidden"
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.86, 0, 0.07, 1] }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={active}
              className="breadcrumb-label"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {PAGE_LABELS[active]}
            </motion.p>
          </AnimatePresence>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.3rem', alignItems: 'baseline', overflow: 'hidden' }}>
            <CreditsWord text="@David" delay={0.6} />
            <CreditsWord text="Quijada" delay={0.72} />
          </div>
        </motion.aside>
      )}

      <RightNav active={active} setActive={setActive} />

      <AnimatePresence>
        {showSearch && <UserSearchModal onClose={() => setShowSearch(false)} />}
      </AnimatePresence>

      <motion.main
        className="page-content"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.86, 0, 0.07, 1] }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {renderPage(active, setActive, monospaced, setMonospaced)}
          </motion.div>
        </AnimatePresence>
      </motion.main>

      {active !== 'player' && <MiniPlayer />}
      <MobileNav active={active} setActive={setActive} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/user/:username" element={<UserProfile />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}