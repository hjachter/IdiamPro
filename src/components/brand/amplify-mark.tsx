import { cn } from "@/lib/utils";

/**
 * AmplifyMark — the IdeaM app-tile monogram.
 *
 * A rounded-square tile with a blue gradient fill containing four white
 * rounded bars ascending left→right (the "Amplify mark"). Replaces the old
 * standalone "M" monogram tile. The gradient + bars are owned here; the caller
 * passes size / corner-radius / shadow / hover classes via `className`.
 */
export function AmplifyMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center",
        className
      )}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="w-[70%] h-[70%]">
        <rect x="20" y="56" width="12" height="20" rx="6" fill="#fff" />
        <rect x="38" y="42" width="12" height="34" rx="6" fill="#fff" />
        <rect x="56" y="28" width="12" height="48" rx="6" fill="#fff" />
        <rect x="74" y="14" width="12" height="62" rx="6" fill="#fff" />
      </svg>
    </div>
  );
}
