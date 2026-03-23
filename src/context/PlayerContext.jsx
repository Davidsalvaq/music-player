import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

// ── Two separate contexts ─────────────────────────────────────────────────────
// PlayerStateContext  → songs, currentIndex, playing, volume — changes rarely
// PlayerProgressContext → progress, duration               — changes ~4x/sec
//
// Components subscribe only to what they need, so progress ticks don't
// re-render Home, Library, Settings, or the track list.

const PlayerStateContext    = createContext({})
const PlayerProgressContext = createContext({ progress: 0, duration: 0 })

export function PlayerProvider({ children }) {
  const [songs, setSongs]               = useState([])
  const [currentIndex, setCurrentIndex] = useState(null)
  const [playing, setPlaying]           = useState(false)
  const [volume, setVolume]             = useState(0.8)
  const [progress, setProgress]         = useState(0)
  const [duration, setDuration]         = useState(0)

  const audioRef = useRef(new Audio())

  // ── Load new track ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentIndex === null) return
    const audio = audioRef.current
    audio.src = songs[currentIndex]?.file_url ?? ''
    audio.volume = volume
    audio.play().catch(() => {})
    setPlaying(true)
    setProgress(0)
  }, [currentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current

    const updateProgress = () => setProgress(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const onEnded        = () => setCurrentIndex(i => (i + 1) % songs.length)

    audio.addEventListener('timeupdate',     updateProgress)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended',          onEnded)

    return () => {
      audio.removeEventListener('timeupdate',     updateProgress)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended',          onEnded)
    }
  }, [currentIndex, songs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ───────────────────────────────────────────────────────────────
  const play   = useCallback(() => { audioRef.current.play().catch(() => {}); setPlaying(true)  }, [])
  const pause  = useCallback(() => { audioRef.current.pause(); setPlaying(false) }, [])
  const toggle = useCallback(() => { playing ? pause() : play() }, [playing, play, pause])
  const next   = useCallback(() => setCurrentIndex(i => (i + 1) % songs.length), [songs.length])
  const prev   = useCallback(() => setCurrentIndex(i => (i - 1 + songs.length) % songs.length), [songs.length])

  const seek = useCallback((val) => {
    audioRef.current.currentTime = val
    setProgress(val)
  }, [])

  const changeVolume = useCallback((val) => {
    audioRef.current.volume = val
    setVolume(val)
  }, [])

  const playSong = useCallback((index, songList) => {
    if (songList) setSongs(songList)
    setCurrentIndex(index)
  }, [])

  const formatTime = useCallback((s) => {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }, [])

  const current = currentIndex !== null ? songs[currentIndex] : null

  return (
    <PlayerStateContext.Provider value={{
      songs, setSongs,
      currentIndex, setCurrentIndex,
      playing, volume,
      toggle, next, prev, seek, changeVolume, playSong, formatTime,
      current,
    }}>
      <PlayerProgressContext.Provider value={{ progress, duration }}>
        {children}
      </PlayerProgressContext.Provider>
    </PlayerStateContext.Provider>
  )
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
// usePlayer()         → full state + controls (excludes progress/duration)
// usePlayerProgress() → only progress + duration (subscribe sparingly)
// usePlayerAll()      → everything — use only in components that need both
//                        (Player panel, MiniPlayer)

export const usePlayer        = () => useContext(PlayerStateContext)
export const usePlayerProgress = () => useContext(PlayerProgressContext)
export const usePlayerAll     = () => ({
  ...useContext(PlayerStateContext),
  ...useContext(PlayerProgressContext),
})