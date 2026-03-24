import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import { getCover } from '../lib/covers'

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
  const navigate = useNavigate()
  const [songCount, setSongCount] = useState(0)
  const [playlistCount, setPlaylistCount] = useState(0)
  const [featuredReview, setFeaturedReview] = useState(null)
  const [recentReviews, setRecentReviews] = useState([])
  const [weekStats, setWeekStats] = useState(null)
  const [feedTab, setFeedTab] = useState('global')

  const displayUsername = (profile?.username || user?.email?.split('@')[0] || '').toUpperCase()
  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!user) return
    supabase.from('songs').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setSongCount(count || 0))
    supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setPlaylistCount(count || 0))

    // Featured review — most recent with rating >= 4
    supabase.from('song_ratings')
      .select('*, profiles(username, avatar_url), songs(id, title, artist, cover_url)')
      .gte('rating', 4)
      .not('review', 'is', null)
      .neq('review', '')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => setFeaturedReview(data))

    // Week stats — most rated song
    supabase.from('song_ratings')
      .select('song_id, songs(id, title, artist, cover_url)')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const counts = {}
        data.forEach(r => { counts[r.song_id] = (counts[r.song_id] || 0) + 1 })
        const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        const topEntry = data.find(r => r.song_id === topId)
        if (topEntry) setWeekStats({ song: topEntry.songs, count: counts[topId] })
      })
  }, [user])

  useEffect(() => {
    const loadFeed = async () => {
      let query = supabase.from('song_ratings')
        .select('*, profiles(username, avatar_url), songs(id, title, artist, cover_url)')
        .not('review', 'is', null)
        .neq('review', '')
        .order('created_at', { ascending: false })

      if (feedTab === 'following' && user) {
        const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
        if (!follows || follows.length === 0) {
          setRecentReviews([])
          return
        }
        query = query.in('user_id', follows.map(f => f.following_id))
      }

      const { data } = await query.limit(8)
      setRecentReviews(data || [])
    }
    loadFeed()
  }, [user, feedTab])

  return (
    <div className="home-shell">
      {/* ── Hero ─────────────────────────────── */}
      <motion.div className="home-hero" variants={stagger} initial="hidden" animate="show">
        <motion.p variants={fadeUp} className="home-date">{today.toUpperCase()}</motion.p>
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', minWidth: 0 }}>
          <div
            className="account-avatar"
            style={{ width: '80px', height: '80px', flexShrink: 0, fontSize: '2rem', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: profile?.avatar_url ? 'transparent' : 'inherit' }}
          >
            {!profile?.avatar_url && (displayUsername?.[0] || 'U')}
          </div>
          <h1 className="home-title" style={{ margin: 0, fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: '1.1', minWidth: 0, wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
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

      {/* ── EN LA COMUNIDAD (featured review) ── */}
      {featuredReview && (
        <motion.section
          className="community-quote-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{
            '--cover-url': featuredReview.songs?.cover_url
              ? `url(${featuredReview.songs.cover_url})`
              : `url(${getCover(featuredReview.songs)})`
          }}
        >
          <div className="community-quote-bg" />
          <div className="community-quote-inner">
            <p className="community-quote-tag">EN LA COMUNIDAD</p>
            <p className="community-quote-stars">{'★'.repeat(featuredReview.rating)}{'☆'.repeat(5 - featuredReview.rating)}</p>
            <p className="community-quote-text">"{featuredReview.review}"</p>
            <div className="community-quote-meta">
              <button
                className="community-quote-user"
                onClick={() => navigate(`/user/${featuredReview.profiles?.username}`)}
              >
                @{featuredReview.profiles?.username}
              </button>
              <span style={{ opacity: 0.4 }}>sobre</span>
              <span className="community-quote-song">{cleanTitle(featuredReview.songs?.title)}</span>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── ESTA SEMANA ── */}
      {weekStats && (
        <motion.section
          className="home-week-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="home-section-title">ESTA SEMANA</p>
          <div className="week-stat-card">
            <img
              src={getCover(weekStats.song)}
              alt=""
              className="cover-img"
              style={{ width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none' }}
            />
            <div>
              <p style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '0.08em', marginBottom: '0.2rem' }}>CANCIÓN MÁS CALIFICADA</p>
              <p style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>{cleanTitle(weekStats.song?.title)}</p>
              <p style={{ opacity: 0.6, fontSize: '0.8rem', fontFamily: "'Space Grotesk', sans-serif" }}>{weekStats.count} calificaciones esta semana</p>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── ÚLTIMAS RESEÑAS ── */}
      <motion.section
        className="home-feed-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="home-section-title" style={{ margin: 0 }}>ÚLTIMAS RESEÑAS</p>
            <div style={{ display: 'flex', gap: '0.8rem', marginLeft: 'auto' }}>
              <button 
                onClick={() => setFeedTab('global')}
                className={`feed-tab ${feedTab === 'global' ? 'active' : ''}`}
              >
                GLOBAL
              </button>
              <button 
                onClick={() => setFeedTab('following')}
                className={`feed-tab ${feedTab === 'following' ? 'active' : ''}`}
              >
                SIGUIENDO
              </button>
            </div>
          </div>

          <div className="feed-cards-grid">
            {recentReviews.length === 0 && feedTab === 'following' && (
              <p style={{ opacity: 0.4, fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.8rem', gridColumn: '1 / -1', padding: '1rem 0' }}>
                Aún no sigues a nadie o no tienen reseñas recientes.
              </p>
            )}
            {recentReviews.map((r, i) => (
              <motion.div
                key={r.id}
                className="feed-card"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                onClick={() => navigate(`/user/${r.profiles?.username}`)}
              >
                <div
                  className="feed-card-cover"
                  style={{ backgroundImage: r.songs?.cover_url ? `url(${r.songs.cover_url})` : `url(${getCover(r.songs)})` }}
                />
                <div className="feed-card-content">
                  <p className="feed-card-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                  <p className="feed-card-title">{cleanTitle(r.songs?.title)}</p>
                  {r.review && <p className="feed-card-review">"{r.review}"</p>}
                  <p className="feed-card-user">@{r.profiles?.username}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

      {/* ── Now playing ticker ── */}
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