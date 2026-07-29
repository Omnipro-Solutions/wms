/**
 * Short haptic + audio cue so a floor operator gets scan feedback without
 * watching the screen closely. Shared by every scan surface — BarcodeScanner
 * (camera/RF) and ScanInput (manual/RF field) — so picking, packing and
 * receiving all react identically to a good vs. bad read.
 *
 * A good read = one short vibration + a high (880 Hz) blip.
 * A bad read  = a triple vibration + a low (220 Hz) buzz.
 *
 * Audio is best-effort (some browsers block it without a gesture); the
 * vibration still fires when audio is unavailable.
 */
export const scanFeedback = (ok: boolean): void => {
  if (typeof window === 'undefined') return
  navigator.vibrate?.(ok ? 60 : [40, 40, 40])
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => ctx.close()
  } catch {
    // audio is best-effort; vibration still fired
  }
}
