const heights = [42, 68, 55, 80, 38, 72, 60, 90, 48, 66, 58, 84, 46, 74];

export default function VolumeBars() {
  return (
    <div className="mt-3 flex h-8 items-end gap-1" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={index}
          className={`flex-1 rounded-sm ${index > 10 ? "bg-emerald-500/40" : "bg-emerald-500/20"}`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}
