/**
 * Interface sounds, synthesised rather than loaded. Two reasons: no audio files
 * to download before the first click feels responsive, and a brass "clunk" is
 * three oscillators, which is less code than a loader plus a cache.
 *
 * Nothing here throws. Audio is decoration, so a browser that refuses to play
 * must degrade to silence and never break a button.
 */

export type SoundName = 'hover' | 'press' | 'roll' | 'success' | 'failure'

let context: AudioContext | null = null
let enabled = true

/** Browsers suspend audio until the user has interacted; resumed on first press. */
function audio(): AudioContext | null {
  if (typeof window === 'undefined' || window.AudioContext === undefined) return null
  if (context === null) context = new AudioContext()
  return context
}

export function setSoundEnabled(next: boolean): void {
  enabled = next
}

interface ToneSpec {
  shape: OscillatorType
  from: number
  to: number
  gain: number
  duration: number
  delay?: number
}

const VOICES: Record<SoundName, ToneSpec[]> = {
  // Barely there. A hover tick that announces itself is a hover tick you turn off.
  hover: [{ shape: 'triangle', from: 660, to: 620, gain: 0.014, duration: 0.045 }],

  // Brass under tension: a bright strike over a low body that falls away.
  press: [
    { shape: 'square', from: 520, to: 190, gain: 0.03, duration: 0.075 },
    { shape: 'triangle', from: 165, to: 110, gain: 0.055, duration: 0.16 },
  ],

  // Something tumbling and settling.
  roll: [
    { shape: 'triangle', from: 320, to: 240, gain: 0.03, duration: 0.07 },
    { shape: 'triangle', from: 260, to: 180, gain: 0.03, duration: 0.08, delay: 0.075 },
    { shape: 'triangle', from: 200, to: 150, gain: 0.026, duration: 0.1, delay: 0.15 },
  ],

  // A rising pair — a fifth up reads as "good" almost everywhere.
  success: [
    { shape: 'sine', from: 523, to: 523, gain: 0.05, duration: 0.11 },
    { shape: 'sine', from: 784, to: 784, gain: 0.045, duration: 0.2, delay: 0.09 },
  ],

  // The same shape falling, so failure is legible without being a buzzer.
  failure: [
    { shape: 'sine', from: 392, to: 392, gain: 0.045, duration: 0.12 },
    { shape: 'sine', from: 262, to: 247, gain: 0.05, duration: 0.26, delay: 0.1 },
  ],
}

export function playSound(name: SoundName): void {
  if (!enabled) return

  const ctx = audio()
  if (ctx === null) return
  if (ctx.state === 'suspended') void ctx.resume()

  const start = ctx.currentTime

  for (const voice of VOICES[name]) {
    const at = start + (voice.delay ?? 0)
    const oscillator = ctx.createOscillator()
    const amplifier = ctx.createGain()

    oscillator.type = voice.shape
    oscillator.frequency.setValueAtTime(voice.from, at)
    if (voice.to !== voice.from) {
      oscillator.frequency.exponentialRampToValueAtTime(voice.to, at + voice.duration)
    }

    // A 6ms attack instead of an instant one; square waves click audibly otherwise.
    amplifier.gain.setValueAtTime(0.0001, at)
    amplifier.gain.exponentialRampToValueAtTime(voice.gain, at + 0.006)
    amplifier.gain.exponentialRampToValueAtTime(0.0001, at + voice.duration)

    oscillator.connect(amplifier).connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + voice.duration + 0.02)
  }
}
