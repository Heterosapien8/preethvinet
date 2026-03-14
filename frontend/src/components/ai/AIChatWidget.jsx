import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, SendHorizonal, X } from 'lucide-react'
import clsx from 'clsx'
import AIStatusIndicator from './AIStatusIndicator'
import ChatMessage from './ChatMessage'
import { queryCitizenBot, queryPrithviAI } from '../../services/ai/prithviAIService'
import cecbLogo from '../../assets/cecb-logo.svg'

const OFFICER_SUGGESTIONS = [
  'What is the inspection priority for this week?',
  'Which industries are currently in violation?',
  'How many reports are pending for this region?',
]

const CITIZEN_SUGGESTIONS = [
  'What does this AQI mean for my health?',
  'Is the water safe to drink today?',
  'Should I wear a mask today?',
]

export default function AIChatWidget({
  variant = 'officer',
  scope = {},
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const messageViewportRef = useRef(null)
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      author: variant === 'citizen' ? 'Citizen Bot' : 'PrithviAI',
      text: variant === 'citizen'
        ? 'Ask about air, water, noise, or what today’s readings mean for your family.'
        : 'Ask about violations, inspections, trends, or pending reports and I will use the latest Firestore context.',
    },
  ])
  const [loading, setLoading] = useState(false)
  const suggestions = variant === 'citizen' ? CITIZEN_SUGGESTIONS : OFFICER_SUGGESTIONS

  const theme = useMemo(() => (
    variant === 'citizen'
      ? {
          panel: 'bg-white border-gray-200',
          accent: 'sky',
          button: 'bg-primary-700 hover:bg-primary-800',
          title: 'Citizen Bot',
          subtitle: 'Plain-language environmental guidance',
          chip: 'border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100',
          header: 'bg-primary-700 border-primary-800 text-white',
        }
      : {
          panel: 'bg-white border-gray-200',
          accent: 'emerald',
          button: 'bg-primary-700 hover:bg-primary-800',
          title: 'PrithviAI',
          subtitle: 'Compliance intelligence assistant',
          chip: 'border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100',
          header: 'bg-primary-700 border-primary-800 text-white',
        }
  ), [variant])

  useEffect(() => {
    if (!isOpen) return

    const viewport = messageViewportRef.current
    if (!viewport) return

    viewport.scrollTop = viewport.scrollHeight
  }, [isOpen, messages, loading])

  async function submitPrompt(promptText) {
    const nextQuestion = promptText.trim()
    if (!nextQuestion || loading) return

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text: nextQuestion },
    ])
    setQuestion('')
    setLoading(true)

    try {
      const response = variant === 'citizen'
        ? await queryCitizenBot(nextQuestion, scope)
        : await queryPrithviAI(nextQuestion, scope)

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          author: variant === 'citizen' ? 'Citizen Bot' : 'PrithviAI',
          text: response.error ?? response.text ?? 'PrithviAI is currently offline',
        },
      ])
    } catch (error) {
      console.error(error)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          author: variant === 'citizen' ? 'Citizen Bot' : 'PrithviAI',
          text: 'PrithviAI is currently offline',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={clsx('fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3', className)}>
      {isOpen && (
        <div className={`w-[min(92vw,420px)] overflow-hidden rounded-2xl border ${theme.panel} shadow-2xl`}>
          <div className={clsx('border-b px-5 py-4', theme.header)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/12 p-1">
                    <img src={cecbLogo} alt="CECB" className="h-full w-full object-contain" />
                  </div>
                  <p className="text-lg font-semibold text-white">{theme.title}</p>
                </div>
                <p className="text-sm text-primary-100">{theme.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4">
              <AIStatusIndicator compact />
            </div>
          </div>

          <div
            ref={messageViewportRef}
            className="max-h-[420px] space-y-3 overflow-y-auto bg-gray-50 px-4 py-4 text-gray-900"
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} accent={theme.accent} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                  Thinking with live context...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white px-4 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitPrompt(suggestion)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    theme.chip
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                submitPrompt(question)
              }}
              className="flex items-end gap-3"
            >
              <textarea
                rows={2}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={variant === 'citizen' ? 'Ask what today means for your family...' : 'Ask about violations, trends, or inspection priorities...'}
                className="min-h-[72px] flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className={clsx(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-50',
                  theme.button
                )}
              >
                <SendHorizonal size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={clsx(
          'group flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg transition',
          theme.button
        )}
      >
        <div className="rounded-lg bg-white/20 p-2">
          <MessageSquare size={18} />
        </div>
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/70">
            {variant === 'citizen' ? 'Public bot' : 'AI assistant'}
          </p>
          <p className="text-sm font-semibold">{theme.title}</p>
        </div>
      </button>
    </div>
  )
}
