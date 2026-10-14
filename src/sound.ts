import type { StorageLike } from './storage.ts';

const KEY = 'michiratagame.sound';
export function createSound(storage: StorageLike) {
  let enabled = true;
  try { enabled = storage.getItem(KEY) !== 'off'; } catch { /* Play without saved preferences. */ }
  let context: AudioContext | undefined;
  let voice: OscillatorNode | undefined;
  function stop() {
    if (voice) { voice.stop(); voice.disconnect(); voice = undefined; }
  }
  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      if (!enabled) stop();
      try { storage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* Keep the setting for this session. */ }
      return enabled;
    },
    play(pitch = 1) {
      if (!enabled) return;
      try {
        context ??= new AudioContext();
        if (context.state === 'suspended') void context.resume().catch(() => {});
        stop();
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        const now = context.currentTime;
        // shortcut: a nasal synthesized “ñiii”, replace with a recording if desired.
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(420 * pitch, now);
        oscillator.frequency.exponentialRampToValueAtTime(850 * pitch, now + 0.05);
        oscillator.frequency.exponentialRampToValueAtTime(640 * pitch, now + 0.22);
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 1.5;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        oscillator.connect(filter).connect(gain).connect(context.destination);
        voice = oscillator;
        oscillator.onended = () => {
          oscillator.disconnect(); filter.disconnect(); gain.disconnect();
          if (voice === oscillator) voice = undefined;
        };
        oscillator.start(now);
        oscillator.stop(now + 0.25);
      } catch { /* Audio support must not interrupt the game. */ }
    },
  };
}
