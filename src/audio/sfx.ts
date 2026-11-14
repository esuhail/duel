/**
 * Sound effects, synthesised with the Web Audio API: no audio files to
 * download or license, and every sound is a few lines of numbers.
 *
 * Keeping it pleasant rather than obnoxious:
 *  - short envelopes (most sounds < 150 ms) and a quiet master volume,
 *  - triangle/sine waves for frequent sounds; square only for rare ones,
 *  - everything passes through a low-pass filter that takes the harsh edge
 *    off chiptune square waves,
 *  - nothing loops, and frequent UI sounds are softer than game events.
 *
 * Deliberately silent: the Reaction "go" moment. A sound there would let a
 * player with audio on react faster (we hear faster than we see) than one
 * with it off, which would make the duel unfair.
 */
import { getSettings } from "../ui/settings";

type Wave = OscillatorType;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3800;
    master = ctx.createGain();
    master.connect(filter).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Browsers only allow audio after a user gesture: unlock on the first one. */
export function unlockAudioOnFirstGesture() {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** One note: frequency (Hz), start offset (s), length (s). */
function note(f: number, at: number, len: number, wave: Wave = "triangle", vol = 0.25, slideTo?: number) {
  const c = audio();
  if (!c || !master) return;
  const s = getSettings();
  master.gain.value = s.volume * 0.6;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(f, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

const arp = (freqs: number[], step: number, len: number, wave: Wave = "square", vol = 0.12) =>
  freqs.forEach((f, i) => note(f, i * step, len, wave, vol));

// Musical notes (Hz) used below.
const C5 = 523, E5 = 659, G5 = 784, C6 = 1047, E6 = 1319, G4 = 392, A4 = 440, E4 = 330;
/** Memory pads: a classic four-tone set, low to high. */
const PAD_TONES: Record<string, number> = { red: 330, blue: 440, yellow: 554, green: 659 };

const SOUNDS = {
  /** Menu cursor moves. */
  move: () => note(880, 0, 0.04, "triangle", 0.07),
  /** Any confirm: menu select, Fight, Join. */
  select: () => { note(660, 0, 0.06, "square", 0.08); note(990, 0.05, 0.08, "square", 0.08); },
  back: () => note(520, 0, 0.09, "triangle", 0.12, 330),
  /** Keypad and tile presses: a soft click. */
  key: () => note(1400, 0, 0.025, "triangle", 0.05),
  error: () => note(150, 0, 0.16, "sawtooth", 0.08, 110),
  /** 3-2-1 and go. */
  count: () => note(A4, 0, 0.12, "square", 0.1),
  go: () => note(880, 0, 0.22, "square", 0.12),
  /** A right answer; `size` 1..4 makes bigger answers sound bigger. */
  correct: (size = 1) => arp([C5, E5, G5, C6].slice(0, Math.max(2, Math.min(4, size + 1))), 0.045, 0.09, "triangle", 0.18),
  wrong: () => note(196, 0, 0.12, "triangle", 0.16, 147),
  pop: () => note(720, 0, 0.06, "sine", 0.22, 1300),
  pad: (color = "red") => note(PAD_TONES[color] ?? 440, 0, 0.28, "triangle", 0.22),
  tap: () => note(300, 0, 0.05, "sine", 0.2, 600),
  /** Last five seconds of the clock. */
  tick: () => note(1200, 0, 0.03, "sine", 0.06),
  join: () => arp([G4, C5, E5], 0.07, 0.12, "triangle", 0.18),
  roundWin: () => arp([C5, E5, G5, C6], 0.08, 0.14),
  roundLose: () => arp([G4, E4, 262], 0.11, 0.18, "triangle", 0.18),
  tie: () => arp([A4, A4], 0.12, 0.08, "triangle", 0.15),
  ko: () => { arp([C5, E5, G5, C6, E6], 0.09, 0.16); note(C6, 0.5, 0.5, "square", 0.1); },
  koLose: () => arp([G4, 370, 349, 330], 0.16, 0.24, "triangle", 0.18),
} satisfies Record<string, (arg?: never) => void>;

export type SoundName = keyof typeof SOUNDS;

export function sfx(name: SoundName, arg?: number | string) {
  if (!getSettings().sound) return;
  try {
    (SOUNDS[name] as (a?: number | string) => void)(arg);
  } catch {
    /* audio is a nicety; never let it break the game */
  }
}
