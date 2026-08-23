interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onReplay: () => void;
  canReplay: boolean;
  fontSize: number;
}

export function TextInput({ value, onChange, onSubmit, onReplay, canReplay, fontSize }: Props) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 flex flex-col gap-3">
      <label htmlFor="text-in" className="text-sm font-semibold">
        Type a sentence
      </label>
      <textarea
        id="text-in"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
        }}
        rows={4}
        style={{ fontSize }}
        className="w-full bg-slate-800 rounded-xl p-3 focus:outline-none"
        placeholder="e.g. hello how are you"
        aria-describedby="text-in-help"
      />
      <p id="text-in-help" className="text-xs opacity-70">
        Press Ctrl/Cmd + Enter to translate.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 rounded-xl"
        >
          Translate to Sign
        </button>
        <button
          onClick={onReplay}
          disabled={!canReplay}
          title="Replay the last translated sentence"
          aria-label="Replay last translation"
          className="px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl"
        >
          Replay
        </button>
      </div>
    </div>
  );
}
