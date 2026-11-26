import { TV_SIREN_MS } from '../utils/tvAnnouncements.js'

let context

export function getSirenContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) throw new Error('O navegador da TV não oferece suporte à sirene.')
  if (!context || context.state === 'closed') context = new AudioContext()
  return context
}

export function playTVSiren(context, duration = TV_SIREN_MS) {
  const start = context.currentTime
  const seconds = duration / 1000
  const end = start + seconds
  const oscillator = context.createOscillator()
  const volume = context.createGain()

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(490, start)
  for (let time = 0.5; time < seconds; time += 0.5) {
    oscillator.frequency.exponentialRampToValueAtTime(time % 1 ? 1030 : 490, start + time)
  }
  volume.gain.setValueAtTime(0, start)
  volume.gain.linearRampToValueAtTime(.89, start + .08)
  volume.gain.setValueAtTime(.89, end - .15)
  volume.gain.linearRampToValueAtTime(0, end)
  oscillator.connect(volume).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(end)

  let playing = true
  oscillator.onended = () => {
    playing = false
    oscillator.disconnect()
    volume.disconnect()
  }
  return () => {
    if (playing) oscillator.stop()
  }
}
