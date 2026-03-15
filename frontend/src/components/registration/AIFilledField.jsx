import clsx from 'clsx'

export default function AIFilledField({
  aiFilled = false,
  modified = false,
  children,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border p-3 transition-colors',
        aiFilled
          ? 'border-amber-300 bg-amber-50/80'
          : 'border-transparent bg-transparent p-0',
        className
      )}
    >
      {aiFilled && (
        <div className="mb-2 flex items-center justify-end">
          <span className={clsx(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
            modified
              ? 'bg-amber-200 text-amber-900'
              : 'bg-yellow-300 text-amber-950'
          )}>
            {modified ? 'Modified' : 'AI Filled'}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
