import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerAll } from '../context/PlayerContext'
import { getCover } from '../lib/covers'
import { Play, Pause, SkipBack, SkipForward, ChevronDown } from 'lucide-react'

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/\(MP3[^)]*\)/gi, '').replace(/_+/g, ' ').trim()
}

export default function MiniPlayer() {
  const { current, playing, progress, duration, volume, changeVolume, seek, toggle, next, prev, songs, currentIndex, formatTime } = usePlayerAll()
  const [isExpanded, setIsExpanded] = useState(false)

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0
  const trackNum = currentIndex >= 0 ? `${currentIndex + 1} / ${songs.length}` : ''

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="mini-player"
          onClick={() => setIsExpanded(true)}
          style={{ cursor: 'pointer' }}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.86, 0, 0.07, 1] }}
        >
          {/* progress line across top */}
          <div className="mini-progress-bar">
            <motion.div
              className="mini-progress-fill"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'linear' }}
            />
          </div>

          <motion.div
            className="mini-player-cover-placeholder"
            animate={playing ? { boxShadow: ['0 0 0px rgba(255,255,255,0.1)', '0 0 16px rgba(255,255,255,0.3)', '0 0 0px rgba(255,255,255,0.1)'] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', padding: 0 }}
          >
            <img
              src={getCover(current)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
              onError={e => { e.target.style.display = 'none' }}
            />
          </motion.div>

          <div className="mini-player-info">
            <span className="mini-player-title">{cleanTitle(current.title)}</span>
            <span className="mini-player-artist">{current.artist || 'Desconocido'}</span>
          </div>

          <span className="mini-track-counter">{trackNum}</span>

          <div className="mini-player-controls">
            <button className="player-btn" onClick={(e) => { e.stopPropagation(); prev(); }} style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SkipBack size={22} /></button>
            <button className="player-btn-main" onClick={(e) => { e.stopPropagation(); toggle(); }} style={{ fontSize: '1.4rem', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {playing ? <Pause size={22} /> : <Play size={22} />}
            </button>
            <button className="player-btn" onClick={(e) => { e.stopPropagation(); next(); }} style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SkipForward size={22} /></button>
          </div>
        </motion.div>
      )}

      {/* ── Fullscreen Expanded Modal ── */}
      {current && isExpanded && (
        <motion.div
          className="fullscreen-player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, info) => {
            if (info.offset.y > 100) setIsExpanded(false)
          }}
        >
          <div className="fullscreen-header">
            <button className="fullscreen-close" onClick={() => setIsExpanded(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px' }}>
              <ChevronDown size={32} />
            </button>
            <span className="fullscreen-title-label">REPRODUCIENDO</span>
          </div>

          <div className="fullscreen-cover-wrap">
            <img src={getCover(current)} alt={cleanTitle(current.title)} className="fullscreen-cover" onError={e => e.target.style.display='none'} />
          </div>

          <div className="fullscreen-info">
            <h2 className="fullscreen-title">{cleanTitle(current.title)}</h2>
            <p className="fullscreen-artist">{current.artist || 'Desconocido'}</p>
          </div>

          <div className="fullscreen-progress-row">
            <span className="player-time">{formatTime(progress)}</span>
            <div className="styled-progress-track" style={{ flex: 1 }} onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              seek(ratio * duration)
            }}>
              <motion.div className="styled-progress-fill" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3, ease: 'linear' }} />
            </div>
            <span className="player-time">{formatTime(duration)}</span>
          </div>

          <div className="fullscreen-controls">
            <button className="player-btn" onClick={prev} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px' }}><SkipBack size={36} /></button>
            <button className="player-btn-main" onClick={toggle} style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {playing ? <Pause size={40} /> : <Play size={40} />}
            </button>
            <button className="player-btn" onClick={next} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px' }}><SkipForward size={36} /></button>
          </div>

          <div className="player-volume" style={{ width: '80%', margin: '1rem auto 0', opacity: 0.8 }}>
            <span className="player-time">🔈</span>
            <input type="range" className="player-range" min={0} max={1} step={0.01} value={volume} onChange={e => changeVolume(parseFloat(e.target.value))} />
            <span className="player-time">🔊</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}