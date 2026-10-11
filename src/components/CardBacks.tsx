/** Three card backs riffling while a commander is being rolled. */
export function ShuffleAnimation({ label = 'Shuffling…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-10" role="status" aria-live="polite">
      <div className="relative h-60 w-44">
        <div className="card-back animate-shuffle-a absolute inset-0" />
        <div className="card-back animate-shuffle-b absolute inset-0 z-[2]" />
        <div className="card-back animate-shuffle-c absolute inset-0" />
      </div>
      <p className="font-serif text-amber-100/80">{label}</p>
    </div>
  )
}

/** A fanned hand of card backs for the empty state. */
export function CardFan() {
  const angles = [-14, -5, 5, 14]
  return (
    <div className="relative mx-auto h-44 w-56" aria-hidden>
      {angles.map((angle, i) => (
        <div
          key={angle}
          className="card-back absolute bottom-0 left-1/2 w-28 origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)`, zIndex: i }}
        />
      ))}
    </div>
  )
}
