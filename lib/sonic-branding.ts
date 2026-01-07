/**
 * Sonic Branding System for ProtocolBanks
 *
 * Personal Mode: 气态与回响 - Airy, Shimmer, High-frequency
 * Business Mode: 重力与机械 - Heavy, Mechanical, Low-frequency
 */

type SoundType =
  // Personal Mode Sounds
  | "personal-switch" // Swoosh - 切换到个人模式
  | "personal-hover" // Shimmer - 按钮悬停
  | "personal-success" // Ping with Reverb - 登录成功
  // Business Mode Sounds
  | "business-switch" // Thrummm + Clunk - 切换到企业模式
  | "business-connect" // Mechanical Purr - 硬件钱包连接
  | "multisig-confirm" // Heavy Switch - 多签确认
  // Common Sounds
  | "error" // Error feedback
  | "notification" // Push notification

interface AudioContextPool {
  context: AudioContext | null
  gainNode: GainNode | null
}

class SonicBranding {
  private pool: AudioContextPool = { context: null, gainNode: null }
  private enabled = true
  private volume = 0.5

  constructor() {
    if (typeof window !== "undefined") {
      // Load user preferences
      const savedEnabled = localStorage.getItem("sonic-branding-enabled")
      const savedVolume = localStorage.getItem("sonic-branding-volume")

      if (savedEnabled !== null) this.enabled = savedEnabled === "true"
      if (savedVolume !== null) this.volume = Number.parseFloat(savedVolume)
    }
  }

  private getAudioContext(): AudioContextPool {
    if (typeof window === "undefined") {
      return { context: null, gainNode: null }
    }

    if (!this.pool.context) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      this.pool.context = new AudioContextClass()
      this.pool.gainNode = this.pool.context.createGain()
      this.pool.gainNode.connect(this.pool.context.destination)
      this.pool.gainNode.gain.value = this.volume
    }

    // Resume if suspended (browser autoplay policy)
    if (this.pool.context.state === "suspended") {
      this.pool.context.resume()
    }

    return this.pool
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (typeof window !== "undefined") {
      localStorage.setItem("sonic-branding-enabled", String(enabled))
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.pool.gainNode) {
      this.pool.gainNode.gain.value = this.volume
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("sonic-branding-volume", String(this.volume))
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getVolume(): number {
    return this.volume
  }

  async play(type: SoundType): Promise<void> {
    if (!this.enabled) return

    const { context, gainNode } = this.getAudioContext()
    if (!context || !gainNode) return

    switch (type) {
      case "personal-switch":
        await this.playPersonalSwitch(context, gainNode)
        break
      case "personal-hover":
        await this.playPersonalHover(context, gainNode)
        break
      case "personal-success":
        await this.playPersonalSuccess(context, gainNode)
        break
      case "business-switch":
        await this.playBusinessSwitch(context, gainNode)
        break
      case "business-connect":
        await this.playBusinessConnect(context, gainNode)
        break
      case "multisig-confirm":
        await this.playMultisigConfirm(context, gainNode)
        break
      case "error":
        await this.playError(context, gainNode)
        break
      case "notification":
        await this.playNotification(context, gainNode)
        break
    }
  }

  /**
   * Personal Mode: Swoosh - 干冰升华声
   * Short, airy whoosh sound
   */
  private async playPersonalSwitch(ctx: AudioContext, gain: GainNode): Promise<void> {
    const duration = 0.25
    const now = ctx.currentTime

    // White noise for "air" texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer

    // High-pass filter for airy quality
    const highpass = ctx.createBiquadFilter()
    highpass.type = "highpass"
    highpass.frequency.setValueAtTime(2000, now)
    highpass.frequency.exponentialRampToValueAtTime(8000, now + duration)

    // Envelope
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(0.3, now + 0.02)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)

    noise.connect(highpass)
    highpass.connect(envelope)
    envelope.connect(gain)

    noise.start(now)
    noise.stop(now + duration)
  }

  /**
   * Personal Mode: Shimmer - 水面高频震动
   * Subtle sparkle on hover
   */
  private async playPersonalHover(ctx: AudioContext, gain: GainNode): Promise<void> {
    const duration = 0.15
    const now = ctx.currentTime

    // Multiple high-frequency oscillators for shimmer
    const frequencies = [4000, 5000, 6000]

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + duration)

      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0, now)
      envelope.gain.linearRampToValueAtTime(0.05, now + 0.02)
      envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(envelope)
      envelope.connect(gain)

      osc.start(now + i * 0.02)
      osc.stop(now + duration)
    })
  }

  /**
   * Personal Mode: Ping with Reverb - 清晨钟鸣
   * Light bell sound with long reverb tail
   */
  private async playPersonalSuccess(ctx: AudioContext, gain: GainNode): Promise<void> {
    const duration = 1.5
    const now = ctx.currentTime

    // Bell tone (fundamental + harmonics)
    const fundamental = 880 // A5
    const harmonics = [1, 2, 3, 4.5, 6]

    harmonics.forEach((mult, i) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = fundamental * mult

      const envelope = ctx.createGain()
      const amplitude = 0.15 / (i + 1)
      envelope.gain.setValueAtTime(0, now)
      envelope.gain.linearRampToValueAtTime(amplitude, now + 0.01)
      envelope.gain.exponentialRampToValueAtTime(0.001, now + duration / (i + 1))

      osc.connect(envelope)
      envelope.connect(gain)

      osc.start(now)
      osc.stop(now + duration)
    })

    // Add convolution reverb simulation
    const reverbOsc = ctx.createOscillator()
    reverbOsc.type = "sine"
    reverbOsc.frequency.value = fundamental

    const reverbFilter = ctx.createBiquadFilter()
    reverbFilter.type = "lowpass"
    reverbFilter.frequency.value = 2000

    const reverbGain = ctx.createGain()
    reverbGain.gain.setValueAtTime(0.08, now)
    reverbGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    reverbOsc.connect(reverbFilter)
    reverbFilter.connect(reverbGain)
    reverbGain.connect(gain)

    reverbOsc.start(now)
    reverbOsc.stop(now + duration)
  }

  /**
   * Business Mode: Thrummm + Clunk-Thud - 银行金库门声
   * Deep resonance followed by heavy mechanical lock
   */
  private async playBusinessSwitch(ctx: AudioContext, gain: GainNode): Promise<void> {
    const now = ctx.currentTime

    // Phase 1: Deep "Thrummm" resonance (0 - 0.4s)
    const thrumDuration = 0.4
    const thrumOsc = ctx.createOscillator()
    thrumOsc.type = "sawtooth"
    thrumOsc.frequency.setValueAtTime(60, now)
    thrumOsc.frequency.exponentialRampToValueAtTime(40, now + thrumDuration)

    const thrumFilter = ctx.createBiquadFilter()
    thrumFilter.type = "lowpass"
    thrumFilter.frequency.value = 200
    thrumFilter.Q.value = 5

    const thrumEnvelope = ctx.createGain()
    thrumEnvelope.gain.setValueAtTime(0, now)
    thrumEnvelope.gain.linearRampToValueAtTime(0.4, now + 0.05)
    thrumEnvelope.gain.linearRampToValueAtTime(0.3, now + thrumDuration - 0.1)
    thrumEnvelope.gain.linearRampToValueAtTime(0, now + thrumDuration)

    thrumOsc.connect(thrumFilter)
    thrumFilter.connect(thrumEnvelope)
    thrumEnvelope.connect(gain)

    thrumOsc.start(now)
    thrumOsc.stop(now + thrumDuration)

    // Phase 2: "Clunk-Thud" mechanical lock (0.35s - 0.55s)
    const clunkStart = now + 0.35
    const clunkDuration = 0.2

    // Impact noise
    const impactBuffer = ctx.createBuffer(1, ctx.sampleRate * clunkDuration, ctx.sampleRate)
    const impactData = impactBuffer.getChannelData(0)
    for (let i = 0; i < impactData.length; i++) {
      const t = i / ctx.sampleRate
      impactData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30)
    }

    const impact = ctx.createBufferSource()
    impact.buffer = impactBuffer

    const impactFilter = ctx.createBiquadFilter()
    impactFilter.type = "lowpass"
    impactFilter.frequency.value = 800

    const impactGain = ctx.createGain()
    impactGain.gain.value = 0.5

    impact.connect(impactFilter)
    impactFilter.connect(impactGain)
    impactGain.connect(gain)

    impact.start(clunkStart)

    // Metallic resonance
    const metalOsc = ctx.createOscillator()
    metalOsc.type = "square"
    metalOsc.frequency.setValueAtTime(150, clunkStart)
    metalOsc.frequency.exponentialRampToValueAtTime(80, clunkStart + 0.1)

    const metalEnvelope = ctx.createGain()
    metalEnvelope.gain.setValueAtTime(0.3, clunkStart)
    metalEnvelope.gain.exponentialRampToValueAtTime(0.001, clunkStart + 0.15)

    metalOsc.connect(metalEnvelope)
    metalEnvelope.connect(gain)

    metalOsc.start(clunkStart)
    metalOsc.stop(clunkStart + 0.15)
  }

  /**
   * Business Mode: Mechanical Purr - 精密仪器运转声
   * For hardware wallet connection
   */
  private async playBusinessConnect(ctx: AudioContext, gain: GainNode): Promise<void> {
    const duration = 0.8
    const now = ctx.currentTime

    // Low frequency rumble
    const rumbleOsc = ctx.createOscillator()
    rumbleOsc.type = "sawtooth"
    rumbleOsc.frequency.setValueAtTime(50, now)

    const rumbleFilter = ctx.createBiquadFilter()
    rumbleFilter.type = "lowpass"
    rumbleFilter.frequency.value = 150

    // Amplitude modulation for "purr" effect
    const lfo = ctx.createOscillator()
    lfo.type = "sine"
    lfo.frequency.value = 15 // 15 Hz modulation

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15

    const rumbleGain = ctx.createGain()
    rumbleGain.gain.setValueAtTime(0, now)
    rumbleGain.gain.linearRampToValueAtTime(0.25, now + 0.1)
    rumbleGain.gain.setValueAtTime(0.25, now + duration - 0.2)
    rumbleGain.gain.linearRampToValueAtTime(0, now + duration)

    lfo.connect(lfoGain)
    lfoGain.connect(rumbleGain.gain)

    rumbleOsc.connect(rumbleFilter)
    rumbleFilter.connect(rumbleGain)
    rumbleGain.connect(gain)

    rumbleOsc.start(now)
    lfo.start(now)
    rumbleOsc.stop(now + duration)
    lfo.stop(now + duration)

    // High-frequency mechanical whine
    const whineOsc = ctx.createOscillator()
    whineOsc.type = "sine"
    whineOsc.frequency.setValueAtTime(2000, now)
    whineOsc.frequency.linearRampToValueAtTime(3000, now + duration)

    const whineGain = ctx.createGain()
    whineGain.gain.setValueAtTime(0, now)
    whineGain.gain.linearRampToValueAtTime(0.02, now + 0.1)
    whineGain.gain.linearRampToValueAtTime(0.02, now + duration - 0.1)
    whineGain.gain.linearRampToValueAtTime(0, now + duration)

    whineOsc.connect(whineGain)
    whineGain.connect(gain)

    whineOsc.start(now)
    whineOsc.stop(now + duration)
  }

  /**
   * Business Mode: Heavy Switch - 重型闸刀开关
   * For multisig confirmation
   */
  private async playMultisigConfirm(ctx: AudioContext, gain: GainNode): Promise<void> {
    const duration = 0.3
    const now = ctx.currentTime

    // Sharp attack noise
    const attackBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
    const attackData = attackBuffer.getChannelData(0)
    for (let i = 0; i < attackData.length; i++) {
      const t = i / ctx.sampleRate
      attackData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 100)
    }

    const attack = ctx.createBufferSource()
    attack.buffer = attackBuffer

    const attackFilter = ctx.createBiquadFilter()
    attackFilter.type = "bandpass"
    attackFilter.frequency.value = 500
    attackFilter.Q.value = 2

    const attackGain = ctx.createGain()
    attackGain.gain.value = 0.6

    attack.connect(attackFilter)
    attackFilter.connect(attackGain)
    attackGain.connect(gain)

    attack.start(now)

    // Heavy thunk body
    const thunkOsc = ctx.createOscillator()
    thunkOsc.type = "sine"
    thunkOsc.frequency.setValueAtTime(100, now)
    thunkOsc.frequency.exponentialRampToValueAtTime(50, now + duration)

    const thunkEnvelope = ctx.createGain()
    thunkEnvelope.gain.setValueAtTime(0.4, now)
    thunkEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration)

    thunkOsc.connect(thunkEnvelope)
    thunkEnvelope.connect(gain)

    thunkOsc.start(now)
    thunkOsc.stop(now + duration)

    // Metallic ring
    const ringOsc = ctx.createOscillator()
    ringOsc.type = "triangle"
    ringOsc.frequency.value = 800

    const ringEnvelope = ctx.createGain()
    ringEnvelope.gain.setValueAtTime(0.15, now)
    ringEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    ringOsc.connect(ringEnvelope)
    ringEnvelope.connect(gain)

    ringOsc.start(now)
    ringOsc.stop(now + 0.2)
  }

  /**
   * Error sound - Short, dissonant
   */
  private async playError(ctx: AudioContext, gain: GainNode): Promise<void> {
    const duration = 0.2
    const now = ctx.currentTime

    const frequencies = [200, 250] // Dissonant interval

    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator()
      osc.type = "square"
      osc.frequency.value = freq

      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0.2, now)
      envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(envelope)
      envelope.connect(gain)

      osc.start(now)
      osc.stop(now + duration)
    })
  }

  /**
   * Notification sound - Attention-grabbing but pleasant
   */
  private async playNotification(ctx: AudioContext, gain: GainNode): Promise<void> {
    const now = ctx.currentTime

    // Two-tone chime
    const notes = [
      { freq: 523.25, start: 0, duration: 0.15 }, // C5
      { freq: 659.25, start: 0.1, duration: 0.2 }, // E5
    ]

    notes.forEach((note) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = note.freq

      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0, now + note.start)
      envelope.gain.linearRampToValueAtTime(0.2, now + note.start + 0.01)
      envelope.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration)

      osc.connect(envelope)
      envelope.connect(gain)

      osc.start(now + note.start)
      osc.stop(now + note.start + note.duration)
    })
  }
}

// Singleton instance
export const sonicBranding = new SonicBranding()

// React hook for easy usage
export function useSonicBranding() {
  return {
    play: (type: SoundType) => sonicBranding.play(type),
    setEnabled: (enabled: boolean) => sonicBranding.setEnabled(enabled),
    setVolume: (volume: number) => sonicBranding.setVolume(volume),
    isEnabled: () => sonicBranding.isEnabled(),
    getVolume: () => sonicBranding.getVolume(),
  }
}
