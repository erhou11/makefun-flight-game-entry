// Generated sound: an engine hum that follows the throttle, wind over the
// airframe, and small cues for rings, drops and knocks. No audio files; the
// context starts on the first key press or click, as browsers require.

const Sound = {
  ctx: null,
  engineOsc: null,
  engineGain: null,
  windGain: null,

  init() {
    if (Sound.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      Sound.ctx = ctx;
      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.value = 58;
      const oscB = ctx.createOscillator();
      oscB.type = 'square';
      oscB.frequency.value = 29;
      oscA.connect(filter); oscB.connect(filter);
      filter.connect(engineGain); engineGain.connect(ctx.destination);
      oscA.start(); oscB.start();
      Sound.engineOsc = [oscA, oscB];
      Sound.engineGain = engineGain;

      const noiseLen = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
      const wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      const windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
      wind.start();
      Sound.windGain = windGain;
    } catch (err) {
      Sound.ctx = null;
    }
  },

  update(throttle, speed, engineOn) {
    if (!Sound.ctx) return;
    const t = Sound.ctx.currentTime;
    const freq = 52 + throttle * 78;
    Sound.engineOsc[0].frequency.setTargetAtTime(freq, t, 0.08);
    Sound.engineOsc[1].frequency.setTargetAtTime(freq / 2, t, 0.08);
    Sound.engineGain.gain.setTargetAtTime(engineOn ? 0.05 + throttle * 0.09 : 0, t, 0.1);
    Sound.windGain.gain.setTargetAtTime(clamp(speed / 62, 0, 1) * 0.05, t, 0.15);
  },

  blip(freq, seconds, gain, type) {
    if (!Sound.ctx) return;
    const ctx = Sound.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(g); g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  },

  chime() { Sound.blip(880, 0.18, 0.12); Sound.blip(1318, 0.24, 0.09); },
  drop() { Sound.blip(392, 0.12, 0.1, 'triangle'); },
  thud() { Sound.blip(74, 0.22, 0.22, 'sine'); },
  fanfare() {
    Sound.blip(523, 0.16, 0.11, 'triangle');
    setTimeout(() => Sound.blip(659, 0.16, 0.11, 'triangle'), 130);
    setTimeout(() => Sound.blip(784, 0.3, 0.12, 'triangle'), 260);
  },
};
