import clsx from 'clsx'

export default function ChatMessage({ message, accent = 'emerald' }) {
  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm',
          isUser
            ? accent === 'sky'
              ? 'bg-primary-700 text-white'
              : 'bg-primary-700 text-white'
            : 'border border-gray-200 bg-white text-gray-700'
        )}
      >
        <p className="mb-1 text-[10px] uppercase tracking-[0.22em] opacity-70">
          {isUser ? 'You' : message.author ?? 'PrithviAI'}
        </p>
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  )
}
