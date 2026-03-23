import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePlayerAll } from '../context/PlayerContext'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function cleanTitle(title) {
  if (!title) return ''
  // Remove parenthesized groups that reference codec/quality info
  return title
    .replace(/\(MP3[^)]*\)/gi, '')
    .replace(/_+/g, ' ')
    .trim()
}

function KeyboardNotification({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="kb-notification"
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Player() {
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [durations, setDurations] = useState({})
  const [hoveredTrack, setHoveredTrack] = useState(null)
  const [playlists, setPlaylists] = useState([])
  const [playlistTarget, setPlaylistTarget] = useState(null)
  const [editSong, setEditSong] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [kbNote, setKbNote] = useState('')

  const { user } = useAuth()
  const { songs, setSongs, currentIndex, playing, progress, duration, volume, toggle, next, prev, seek, changeVolume, playSong, current } = usePlayerAll()

  // ── Fetch songs ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchSongs = async () => {
      const { data } = await supabase.from('songs').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setSongs(data || [])
    }
    fetchSongs()
  }, [user.id])

  // ── Load durations lazily — 3 at a time to avoid hammering CDN ──
  const loadingRef = useRef(new Set())
  useEffect(() => {
    if (!songs.length) return
    const BATCH = 3
    const pending = songs.filter(s => !durations[s.id] && s.file_url && !loadingRef.current.has(s.id))
    pending.slice(0, BATCH).forEach(song => {
      loadingRef.current.add(song.id)
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.addEventListener('loadedmetadata', () => {
        setDurations(prev => ({ ...prev, [song.id]: audio.duration }))
        loadingRef.current.delete(song.id)
        audio.src = '' // release network resource
      }, { once: true })
      audio.src = song.file_url
    })
  }, [songs, durations])

  // ── Fetch playlists ─────────────────────────────────────────────
  useEffect(() => {
    supabase.from('playlists').select('*').eq('user_id', user.id)
      .then(({ data }) => setPlaylists(data || []))
  }, [user.id])

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const showNote = useCallback((msg) => {
    setKbNote(msg)
    setTimeout(() => setKbNote(''), 1200)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); toggle(); showNote(playing ? 'PAUSADO' : 'REPRODUCIENDO') }
      if (e.key === 'ArrowRight') { next(); showNote('SIGUIENTE ⏭') }
      if (e.key === 'ArrowLeft') { prev(); showNote('ANTERIOR ⏮') }
      if (e.key === 'm' || e.key === 'M') { changeVolume(volume > 0 ? 0 : 0.8); showNote(volume > 0 ? 'SILENCIADO 🔇' : 'CON SONIDO 🔊') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, next, prev, playing, volume, showNote])

  // ── Edit handlers ─────────────────────────────────────────────
  const openEdit = (song, e) => { e.stopPropagation(); setEditSong(song); setEditTitle(song.title); setEditArtist(song.artist || '') }
  const confirmEdit = async () => {
    if (!editSong) return
    const { error } = await supabase.from('songs').update({ title: editTitle, artist: editArtist }).eq('id', editSong.id)
    if (!error) setSongs(prev => prev.map(s => s.id === editSong.id ? { ...s, title: editTitle, artist: editArtist } : s))
    setEditSong(null)
  }

  // ── Playlist handler ──────────────────────────────────────────
  const addToPlaylist = async (playlistId, song) => {
    await supabase.from('playlist_songs').insert({ playlist_id: playlistId, song_id: song.id })
    setPlaylistTarget(null)
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <>
      <KeyboardNotification message={kbNote} />

      {createPortal(
        <AnimatePresence>
          {editSong && (
            <>
              <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditSong(null)} />
              <motion.div className="edit-modal" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2 }}>
                <p className="modal-label">EDITANDO CANCIÓN</p>
                <input className="login-input" type="text" placeholder="TÍTULO" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <input className="login-input" type="text" placeholder="ARTISTA" value={editArtist} onChange={e => setEditArtist(e.target.value)} />
                <div className="modal-actions">
                  <button className="login-btn" onClick={confirmEdit}>GUARDAR</button>
                  <button className="login-btn" style={{ opacity: 0.4 }} onClick={() => setEditSong(null)}>CANCELAR</button>
                </div>
              </motion.div>
            </>
          )}
          {playlistTarget && (
            <>
              <motion.div className="modal-backdrop" style={{ background: 'transparent' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPlaylistTarget(null)} />
              <motion.div className="playlist-dropdown" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                <p className="modal-label" style={{ marginBottom: '0.6rem' }}>AÑADIR A PLAYLIST</p>
                {playlists.length === 0
                  ? <p style={{ fontSize: '0.78rem', opacity: 0.5 }}>Sin playlists. Crea una en Ajustes.</p>
                  : playlists.map(pl => (
                    <button key={pl.id} className="playlist-dropdown-item" onClick={() => addToPlaylist(pl.id, playlistTarget.song)}>
                      {pl.name}
                    </button>
                  ))
                }
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="player-shell">
        {/* ── Track List ─────────────────────────────────── */}
        <div className="player-tracklist">
          <p className="tracklist-label">TU BIBLIOTECA — {songs.length} CANCIONES</p>
          {songs.length === 0 ? (
            <p className="player-empty">Sube canciones en Biblioteca primero.</p>
          ) : (
            songs.map((song, i) => (
              <motion.div
                key={song.id}
                className={`track-item ${currentIndex === i ? 'track-active' : ''}`}
                onClick={() => playSong(i, songs)}
                onHoverStart={() => setHoveredTrack(song.id)}
                onHoverEnd={() => setHoveredTrack(null)}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
              >
                <div className="track-num">
                  {currentIndex === i ? (
                    playing
                      ? <div className="waves-icon"><div className="wave-bar" /><div className="wave-bar" /><div className="wave-bar" /></div>
                      : <span style={{ fontSize: '10px' }}>⏸</span>
                  ) : <span>{i + 1}</span>}
                </div>
                <div className="track-cover-placeholder">♪</div>
                <div className="track-info">
                  <span className="track-title">{cleanTitle(song.title)}</span>
                  <span className="track-artist">{song.artist || 'Desconocido'}</span>
                </div>
                <span className="track-duration">{formatTime(durations[song.id])}</span>
                <div className={`track-actions ${hoveredTrack === song.id ? 'visible' : ''}`}>
                  <button className="track-action-btn" onClick={e => openEdit(song, e)} title="Editar">✎</button>
                  <button className="track-action-btn" onClick={e => { e.stopPropagation(); setPlaylistTarget({ song }) }} title="Añadir a playlist">+</button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* ── Right Panel ─────────────────────────────────── */}
        <div className="player-panel">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.id}
                className="player-panel-inner"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="player-cover-wrap">
                  <motion.div
                    className="player-cover-placeholder"
                    animate={{ rotate: playing ? 360 : 0 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >♪</motion.div>
                </div>

                <div className="player-info">
                  <p className="player-current-title">{cleanTitle(current.title)}</p>
                  <p className="player-current-artist">{current.artist || 'Artista desconocido'}</p>
                </div>

                {/* Styled progress bar */}
                <div className="player-progress-section">
                  <span className="player-time">{formatTime(progress)}</span>
                  <div className="styled-progress-track" onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const ratio = (e.clientX - rect.left) / rect.width
                    seek(ratio * duration)
                  }}>
                    <motion.div className="styled-progress-fill" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3, ease: 'linear' }} />
                  </div>
                  <span className="player-time">{formatTime(duration)}</span>
                </div>

                <div className="player-controls">
                  <button className="player-btn" onClick={() => setShuffle(!shuffle)} style={{ opacity: shuffle ? 1 : 0.3, fontSize: '1.3rem' }}>⇄</button>
                  <button className="player-btn" onClick={prev}>⏮</button>
                  <button className="player-btn-main" onClick={toggle}>
                    {playing ? '⏸' : '▶'}
                  </button>
                  <button className="player-btn" onClick={next}>⏭</button>
                  <button className="player-btn" onClick={() => setRepeat(!repeat)} style={{ opacity: repeat ? 1 : 0.3, fontSize: '1.3rem' }}>↺</button>
                </div>

                <div className="player-volume">
                  <span className="player-time">🔈</span>
                  <input type="range" className="player-range" min={0} max={1} step={0.01} value={volume} onChange={e => changeVolume(parseFloat(e.target.value))} />
                  <span className="player-time">🔊</span>
                </div>

                <p className="player-keyboard-hint">Space · ←→ · M</p>
              </motion.div>
            ) : (
              <motion.div className="player-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="player-idle-text">Selecciona una canción</p>
                <p style={{ fontSize: '0.72rem', opacity: 0.35, fontFamily: "'Space Grotesk', sans-serif", marginTop: '0.5rem' }}>de la lista de la izquierda</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}