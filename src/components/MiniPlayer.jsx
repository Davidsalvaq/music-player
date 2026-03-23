import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerAll } from '../context/PlayerContext'

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/\(MP3[^)]*\)/gi, '').replace(/_+/g, ' ').trim()
}

export default function MiniPlayer() {
  const { current, playing, progress, duration, toggle, next, prev, songs, currentIndex, formatTime } = usePlayerAll()

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0
  const trackNum = currentIndex >= 0 ? `${currentIndex + 1} / ${songs.length}` : ''

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="mini-player"
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
          >♪</motion.div>

          <div className="mini-player-info">
            <span className="mini-player-title">{cleanTitle(current.title)}</span>
            <span className="mini-player-artist">{current.artist || 'Desconocido'}</span>
          </div>

          <span className="mini-track-counter">{trackNum}</span>

          <div className="mini-player-controls">
            <button className="player-btn" onClick={prev}>⏮</button>
            <button className="player-btn-main" onClick={toggle} style={{ fontSize: '1.4rem', width: '44px', height: '44px' }}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="player-btn" onClick={next}>⏭</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}