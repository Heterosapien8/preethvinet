import clsx from 'clsx'

export default function StepIndicator({ currentStep, steps }) {
  return (
    <div className="rounded-[28px] border border-[#dce6e3] bg-white/90 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const active = stepNumber === currentStep
          const complete = stepNumber < currentStep

          return (
            <div key={step.title} className="flex flex-1 items-center gap-3">
              <div className={clsx(
                'flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold transition-colors',
                complete && 'border-emerald-500 bg-emerald-500 text-white',
                active && 'border-primary-700 bg-primary-700 text-white',
                !complete && !active && 'border-gray-200 bg-gray-50 text-gray-500'
              )}>
                {stepNumber}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.26em] text-gray-400">Step {stepNumber}</p>
                <p className={clsx('text-sm font-semibold', active ? 'text-primary-700' : 'text-gray-700')}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={clsx(
                  'ml-auto hidden h-px flex-1 md:block',
                  complete ? 'bg-emerald-500' : 'bg-gray-200'
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
