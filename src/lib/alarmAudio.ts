/**
 * Synthesized Web Audio API Alarm Sound Manager
 * Provides reliable, zero-latency, dependency-free audio alerts that run offline.
 */
class AlarmSoundManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private intervalId: number | null = null
  private isAlarmPlaying: boolean = false
  private activeOscillators: OscillatorNode[] = []

  private initContext() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx) {
      if (!this.masterGain) {
        this.masterGain = this.ctx.createGain()
        this.masterGain.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }
    }
  }

  // Dual-tone urgent alert pulse (A5 -> E5)
  private playBeep() {
    if (!this.ctx || !this.masterGain || !this.isAlarmPlaying) return

    try {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sawtooth'
      // Dual tone: 880 Hz (A5) shifting to 659.25 Hz (E5)
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(659.25, now + 0.15)

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(this.masterGain)

      this.activeOscillators.push(osc)

      osc.onended = () => {
        const idx = this.activeOscillators.indexOf(osc)
        if (idx !== -1) this.activeOscillators.splice(idx, 1)
      }

      osc.start(now)
      osc.stop(now + 0.36)
    } catch (err) {
      console.warn('AudioContext beep execution skipped:', err)
    }
  }

  public startAlert() {
    if (this.isAlarmPlaying) return
    this.stopAlert() // Clear any existing intervals / state

    this.initContext()
    this.isAlarmPlaying = true
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime)
    }

    this.playBeep()

    // Repeat alert pulse every 1.5 seconds until silenced
    this.intervalId = window.setInterval(() => {
      if (this.isAlarmPlaying) {
        this.playBeep()
      }
    }, 1500)
  }

  public stopAlert() {
    this.isAlarmPlaying = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    // Immediately silence master gain
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime)
      } catch {
        // ignore
      }
    }

    // Stop and disconnect any currently sounding oscillators
    for (const osc of this.activeOscillators) {
      try {
        osc.stop()
        osc.disconnect()
      } catch {
        // ignore
      }
    }
    this.activeOscillators = []
  }

  public isPlaying() {
    return this.isAlarmPlaying
  }
}

export const alarmSound = new AlarmSoundManager()
