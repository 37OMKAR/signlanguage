interface Props {
  currentGloss: string;
  upcoming: string[];
  fontSize: number;
}

export function CaptionOverlay({ currentGloss, upcoming, fontSize }: Props) {
  if (!currentGloss && upcoming.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute bottom-0 left-0 right-0 p-4 bg-black/70 backdrop-blur-sm text-center"
    >
      <div style={{ fontSize }} className="font-bold tracking-wide">
        {currentGloss || "…"}
      </div>
      {upcoming.length > 0 && (
        <div
          style={{ fontSize: Math.max(12, fontSize - 8) }}
          className="opacity-60 mt-1"
        >
          next: {upcoming.slice(0, 6).join(" · ")}
          {upcoming.length > 6 ? " …" : ""}
        </div>
      )}
    </div>
  );
}
