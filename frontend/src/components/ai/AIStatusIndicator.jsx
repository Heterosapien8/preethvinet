import { getAIAvailability } from '../../services/ai/prithviAIService'

export default function AIStatusIndicator({ label = 'PrithviAI Status', compact = false }) {
  const availability = getAIAvailability()

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white shadow-sm">
      {!compact && <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">{label}</span>}
      <div className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${availability.online ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' : 'bg-emerald-900/50'}`} />
        <span className={`h-2.5 w-2.5 rounded-full ${availability.online ? 'bg-red-900/50' : 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]'}`} />
      </div>
    </div>
  )
}
