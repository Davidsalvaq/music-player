import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ParticleBackground from './components/ParticleBackground'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Home from './pages/Home'
import Library from './pages/Library'
import Player from './pages/Player'
import Settings from './pages/Settings'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import MiniPlayer from './components/MiniPlayer'

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
    { key: 'home', icon: '⌂', label: 'INICIO' },
    { key: 'library', icon: '♫', label: 'BIBLIOTECA' },
    { key: 'player', icon: '▶', label: 'REPRODUCTOR' },
    { key: 'settings', icon: '⚙', label: 'AJUSTES' }
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

  return (
    <div className="app-shell">
      <CursorGlow />
      <ParticleBackground monospaced={monospaced} />

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
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}