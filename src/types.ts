// Core data types.
// Motion flows as JSON keyframes; nothing plays video.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

// The finger keys we support. Each finger has 3 curl segments except thumb (2).
// Authored in degrees around the local X-axis (finger flexion).
export type FingerName =
  | "R_thumb" | "R_index" | "R_middle" | "R_ring" | "R_pinky"
  | "L_thumb" | "L_index" | "L_middle" | "L_ring" | "L_pinky";

// Authored, human-readable frame in JSON. Optional fields inherit from
// previous frame (or rest pose for frame 0).
export interface AuthoredFrame {
  t_ms: number;
  // Curl in degrees per finger segment: [base, middle, tip]. Thumb uses 2.
  curls?: Partial<Record<FingerName, number[]>>;
  // Whole-hand orientation, Euler XYZ degrees applied in that order.
  R_palm_deg?: [number, number, number];
  L_palm_deg?: [number, number, number];
  // Hand root position offset from rest, in meters.
  R_palm_pos?: [number, number, number];
  L_palm_pos?: [number, number, number];
  // Head/face expression weights, name -> 0..1
  blendshapes?: Record<string, number>;
}

// Compiled runtime frame — pure quaternions per bone. What the player uses.
export interface SignFrame {
  t_ms: number;
  bones: Record<string, Quat>;
  positions?: Record<string, Vec3>;
  blendshapes?: Record<string, number>;
}

export type Provenance =
  | "self-recorded"
  | "hand-authored"
  | "kaggle-google-asl"
  | "kaggle-include-isl"
  | "signmatic-asl"
  | "wlasl-derived";

// Dictionary entry as authored in JSON.
export interface AuthoredEntry {
  gloss: string;
  duration_ms: number;
  frames: AuthoredFrame[];
  handshape_start?: string;
  handshape_end?: string;
  notes?: string;
  provenance: Provenance;
  commercial_safe: boolean;
  // How far up the generic arm-lift arc this sign's hand should travel:
  // 1.0 = full reach (near the head — HELLO, FATHER), ~0.75 = mid reach
  // (chin/mouth level — MOTHER, EAT, DRINK), ~0.45 = low reach (chest
  // level — LOVE, HAPPY, PLEASE). Defaults to 1.0 if omitted. Without
  // this, EVERY sign's hand lands at the exact same world position
  // (measured and confirmed identical to the millimeter across MOTHER/
  // FATHER/DEAF/HAPPY/LOVE/HELLO/EAT/DRINK before this field existed) —
  // wrist rotation alone changes orientation, never position, since the
  // hand pivots around a fixed-length forearm. See docs/RETARGETING.md.
  armReach?: number;
}

// Runtime entry after compilation.
export interface SignEntry {
  gloss: string;
  duration_ms: number;
  frames: SignFrame[];
  provenance: Provenance;
  commercial_safe: boolean;
  notes?: string;
  armReach?: number;
}

// ASL grammar is carried on the face, not just the hands. These flags are
// computed once per translated sentence and held for its whole playback —
// non-manual markers span the clause, not a single sign.
export interface SentenceMood {
  yesNoQuestion: boolean; // raised eyebrows
  whQuestion: boolean;    // furrowed eyebrows
  negation: boolean;      // head shake (also true for a standalone "no")
}

export const NEUTRAL_MOOD: SentenceMood = {
  yesNoQuestion: false,
  whQuestion: false,
  negation: false,
};

// Which sign language the user wants to see. Every dictionary entry
// derives its language from its `provenance` field via provenanceLanguage()
// in the loader: kaggle-include-isl -> "ISL", everything else -> "ASL".
// "any" means don't filter -- fall through to whichever variant exists,
// preferring ASL when both do.
export type SignLanguage = "ASL" | "ISL" | "any";

export interface PlayerSettings {
  speed: number;
  fontSize: number;
  highContrast: boolean;
  dyslexicFont: boolean;
  reducedMotion: boolean;
  ttsEnabled: boolean;
  signLanguage: SignLanguage;
}
