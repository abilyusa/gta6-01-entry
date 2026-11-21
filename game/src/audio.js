// All sound is synthesised with WebAudio — no audio files, no network.
// The engine is a low oscillator whose pitch follows speed, the siren is a
// two-tone wail while the police are after the player, and gunshots, pickups
// and mission jingles are short envelopes. Everything starts on the first
// user gesture, as browsers require.
export function makeAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(context.destination);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(context.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, seconds, type, volume) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + seconds);
  }

  function noise(seconds, volume) {
    if (!context || muted) return;
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  return {
    /** Call from any user gesture; also resumes a suspended context. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Continuous engine hum; call every frame while driving. */
    engine(speed, driving) {
      if (!context || muted) return;
      const target = driving ? 0.035 + Math.min(0.05, Math.abs(speed) / 540 * 0.05) : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.16, context.currentTime, 0.1);
    },
    /** Continuous siren; call every frame with wanted > 0. */
    siren(on, dt) {
      if (!context || muted) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        return;
      }
      sirenTimer += dt;
      const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, context.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(0.025, context.currentTime, 0.1);
    },
    shot() {
      noise(0.12, 0.22);
    },
    enemyShot() {
      noise(0.1, 0.1);
    },
    hit() {
      blip(140, 0.15, 'sawtooth', 0.12);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.1);
      setTimeout(() => blip(1320, 0.15, 'sine', 0.1), 90);
    },
    cash() {
      blip(660, 0.1, 'square', 0.08);
      setTimeout(() => blip(990, 0.18, 'square', 0.08), 80);
    },
    mission() {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => blip(freq, 0.22, 'triangle', 0.12), i * 110));
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => setTimeout(() => blip(freq, 0.25, 'sawtooth', 0.1), i * 140));
    },
  };
}
