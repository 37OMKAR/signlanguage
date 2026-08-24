import type { PlayerSettings, SignLanguage } from "../types";

interface Props {
  settings: PlayerSettings;
  onChange: (s: PlayerSettings) => void;
}

export function ControlsPanel({ settings, onChange }: Props) {
  const set = <K extends keyof PlayerSettings>(k: K, v: PlayerSettings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="bg-slate-900 rounded-2xl p-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Accessibility</h2>

      <label className="flex flex-col gap-1 text-sm">
        Sign language
        <select
          value={settings.signLanguage}
          onChange={(e) => set("signLanguage", e.target.value as SignLanguage)}
          className="bg-slate-800 rounded-lg px-2 py-1"
        >
          <option value="any">Any (prefer ASL, fall back to ISL)</option>
          <option value="ASL">American Sign Language (ASL)</option>
          <option value="ISL">Indian Sign Language (ISL)</option>
        </select>
        <span className="text-xs opacity-60">
          Signs outside the selected language are fingerspelled.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Playback speed: {settings.speed.toFixed(2)}×
        <input
          type="range"
          min={0.25}
          max={2}
          step={0.05}
          value={settings.speed}
          onChange={(e) => set("speed", Number(e.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Caption size: {settings.fontSize}px
        <input
          type="range"
          min={16}
          max={64}
          step={2}
          value={settings.fontSize}
          onChange={(e) => set("fontSize", Number(e.target.value))}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.highContrast}
          onChange={(e) => set("highContrast", e.target.checked)}
        />
        High contrast
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.dyslexicFont}
          onChange={(e) => set("dyslexicFont", e.target.checked)}
        />
        Dyslexia-friendly font
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => set("reducedMotion", e.target.checked)}
        />
        Reduced motion (slower, no blend)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.ttsEnabled}
          onChange={(e) => set("ttsEnabled", e.target.checked)}
        />
        Read text aloud (TTS)
      </label>
    </div>
  );
}
