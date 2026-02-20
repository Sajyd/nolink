let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.08,
  detune = 0
) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail if audio isn't available
  }
}

export function playNodeClick() {
  playTone(880, 0.08, "sine", 0.06);
  setTimeout(() => playTone(1100, 0.06, "sine", 0.04), 40);
}

export function playConnect() {
  playTone(660, 0.1, "sine", 0.06);
  setTimeout(() => playTone(880, 0.1, "sine", 0.05), 70);
  setTimeout(() => playTone(1320, 0.15, "sine", 0.04), 140);
}

export function playAddNode() {
  playTone(523, 0.1, "triangle", 0.07);
  setTimeout(() => playTone(784, 0.12, "triangle", 0.05), 80);
}

export function playRemoveNode() {
  playTone(440, 0.1, "sine", 0.05);
  setTimeout(() => playTone(330, 0.15, "sine", 0.04), 60);
}
