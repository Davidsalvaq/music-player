import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/\(MP3[^)]*\)/gi, '').replace(/_+/g, ' ').trim()
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
}
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.86, 0, 0.07, 1] } }
}

export default function Home({ setActive }) {
  const { user, profile } = useAuth()
  const { current } = usePlayer()
  const [songCount, setSongCount] = useState(0)
  const [playlistCount, setPlaylistCount] = useState(0)

  const displayUsername = (profile?.username || user?.email?.split('@')[0] || '').toUpperCase()
  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!user) return
    supabase.from('songs').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setSongCount(count || 0))
    supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setPlaylistCount(count || 0))
  }, [user])

  return (
    <div className="home-shell">
      {/* ── Hero ─────────────────────────────── */}
      <motion.div className="home-hero" variants={stagger} initial="hidden" animate="show">
        <motion.p variants={fadeUp} className="home-date">{today.toUpperCase()}</motion.p>
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div 
             className="account-avatar" 
             style={{ width: '80px', height: '80px', flexShrink: 0, fontSize: '2rem', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: profile?.avatar_url ? 'transparent' : 'inherit' }}
          >
             {!profile?.avatar_url && (displayUsername?.[0] || 'U')}
          </div>
          <h1 className="home-title" style={{ margin: 0, fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: '1.1' }}>
            HOLA,<br />{displayUsername}
          </h1>
        </motion.div>
        <motion.div variants={fadeUp} className="home-stats-row">
          <div className="stat-pill">
            <span className="stat-num">{songCount}</span>
            <span className="stat-label">CANCIONES</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">{playlistCount}</span>
            <span className="stat-label">PLAYLISTS</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">{current ? '▶' : '—'}</span>
            <span className="stat-label">{current ? 'REPRODUCIENDO' : 'EN PAUSA'}</span>
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="home-actions">
          <button className="editorial-btn" onClick={() => setActive('player')}>REPRODUCIR</button>
          <button className="editorial-btn-sec" onClick={() => setActive('library')}>BIBLIOTECA</button>
        </motion.div>
      </motion.div>

      {/* ── Now playing ticker ───────────────── */}
      {current && (
        <motion.div
          className="home-ticker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="ticker-track">
            {Array(6).fill(`${cleanTitle(current.title)} — ${current.artist || 'Desconocido'} ·  `).map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}