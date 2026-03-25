import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCover } from '../lib/covers'

function cleanTitle(t) {
  if (!t) return ''
  return t.replace(/\(MP3[^)]*\)/gi, '').replace(/_+/g, ' ').trim()
}

function timeAgo(dateStr) {
  if (!dateStr) return 'nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
}

export default function UserProfile() {
  const { username } = useParams()
  const { user: me, profile: myProfile } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const isMe = myProfile?.username === username

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setNotFound(false)

      // Fetch profile by username
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('username', username).maybeSingle()

      if (!profileData) { setNotFound(true); setLoading(false); return }
      setProfile(profileData)

      // Fetch their recent ratings
      const { data: ratingsData } = await supabase
        .from('song_ratings')
        .select('*, songs(id, title, artist, cover_url)')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false })
        .limit(12)
      setRatings(ratingsData || [])

      // Fetch public playlists
      const { data: playlistData } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', profileData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
      setPlaylists(playlistData || [])

      // Fetch follows stats
      const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id)
      const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id)
      setFollowersCount(followers || 0)
      setFollowingCount(following || 0)

      if (me && me.id !== profileData.id) {
        const { data: followDoc } = await supabase.from('follows').select('*').eq('follower_id', me.id).eq('following_id', profileData.id).maybeSingle()
        setIsFollowing(!!followDoc)
      }

      setLoading(false)
    }
    load()
  }, [username, me])

  const toggleFollow = async () => {
    if (!me || isMe || !profile) return
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowersCount(prev => wasFollowing ? prev - 1 : prev + 1)
    
    if (wasFollowing) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', profile.id)
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: profile.id })
    }
  }

  if (loading) return (
    <div className="profile-page">
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ opacity: 0.4, fontFamily: "'Space Grotesk', sans-serif" }}>
        Cargando perfil...
      </motion.p>
    </div>
  )

  if (notFound) return (
    <div className="profile-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', maxWidth: '400px' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>◎</p>
        <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}>
          PERFIL NO ENCONTRADO
        </h1>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", opacity: 0.5, marginTop: '0.5rem' }}>
          @{username} no existe en la plataforma.
        </p>
        <button className="editorial-btn" style={{ marginTop: '2rem' }} onClick={() => navigate(-1)}>
          ← VOLVER
        </button>
      </motion.div>
    </div>
  )

  return (
    <div className="profile-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

        {/* ── Header ── */}
        <div className="profile-header">
          <div
            className="profile-avatar-large"
            style={{
              backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center',
              color: profile.avatar_url ? 'transparent' : 'inherit'
            }}
          >
            {!profile.avatar_url && (profile.username?.[0]?.toUpperCase() || '?')}
          </div>
          <div className="profile-header-info">
            <h1 className="profile-username">@{profile.username}</h1>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            <div className="profile-meta-row">
              <span>{followersCount} Seguidores</span>
              <span>·</span>
              <span>{followingCount} Siguiendo</span>
            </div>
            <div className="profile-meta-row" style={{ marginTop: '0.2rem' }}>
              <span>Miembro desde {new Date(profile.created_at).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</span>
              <span>·</span>
              <span>Visto {timeAgo(profile.last_seen)}</span>
            </div>
            {isMe ? (
              <button className="editorial-btn-sec" style={{ marginTop: '1rem' }} onClick={() => navigate('/?tab=settings')}>
                EDITAR PERFIL
              </button>
            ) : (
              <button 
                className={`editorial-btn-sec ${isFollowing ? 'following' : ''}`} 
                style={{ marginTop: '1rem', opacity: isFollowing ? 0.6 : 1, fontSize: '1.2rem' }} 
                onClick={toggleFollow}
              >
                {isFollowing ? 'DEJAR DE SEGUIR' : 'SEGUIR'}
              </button>
            )}
          </div>
        </div>

        {/* ── Ratings ── */}
        {ratings.length > 0 && (
          <section className="profile-section">
            <p className="settings-label">ÚLTIMAS CALIFICACIONES — {ratings.length}</p>
            <div className="profile-ratings-grid">
              {ratings.map(r => (
                <motion.div
                  key={r.id}
                  className="rating-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    '--cover': r.songs?.cover_url ? `url(${r.songs.cover_url})` : `url(${getCover(r.songs)})`
                  }}
                >
                  <div className="rating-card-bg" />
                  <div className="rating-card-content">
                    <p className="rating-card-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                    <p className="rating-card-title">{r.songs?.title || 'Sin Título'}</p>
                    {r.review && <p className="rating-card-review">"{r.review}"</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Playlists públicas ── */}
        {playlists.length > 0 && (
          <section className="profile-section">
            <p className="settings-label">PLAYLISTS PÚBLICAS — {playlists.length}</p>
            <div className="profile-playlists">
              {playlists.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  className="playlist-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <span style={{ opacity: 0.4, marginRight: '0.5rem' }}>▶</span>
                  {pl.name}
                  <span className="playlist-visibility-badge public" style={{ marginLeft: 'auto' }}>🌐 PÚBLICA</span>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {ratings.length === 0 && playlists.length === 0 && (
          <p style={{ opacity: 0.4, fontFamily: "'Space Grotesk', sans-serif", marginTop: '3rem', textAlign: 'center' }}>
            Este usuario aún no ha calificado canciones ni tiene playlists públicas.
          </p>
        )}

      </motion.div>
    </div>
  )
}
