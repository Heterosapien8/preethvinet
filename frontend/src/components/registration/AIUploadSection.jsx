import { useRef } from 'react'
import { FileText, LoaderCircle, Sparkles, TriangleAlert, UploadCloud } from 'lucide-react'

export default function AIUploadSection({
  loading,
  result,
  error,
  onFileSelect,
  onSkip,
}) {
  const inputRef = useRef(null)

  function handleFiles(files) {
    const file = files?.[0]
    if (file) onFileSelect(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    handleFiles(event.dataTransfer.files)
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-gradient-to-br from-[#0d3b66] via-[#155e75] to-[#1f6f78] p-6 text-white shadow-lg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,208,0,0.16),transparent_35%)]" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] uppercase tracking-[0.38em] text-cyan-100">PrithviAI Auto-Fill</p>
            <h2 className="text-2xl font-semibold text-white">Upload a digital PDF and pre-fill the registration form</h2>
            <p className="mt-2 text-sm text-cyan-50/90">
              Works best for GST certificates, MCA records, project reports, and other digital PDFs. Scanned images are not OCR-enabled yet.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Skip AI Upload
          </button>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className="group flex w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-white/30 bg-white/8 px-6 py-10 text-center transition hover:bg-white/12"
        >
          <div className="mb-4 rounded-full bg-white/12 p-4">
            <UploadCloud className="h-8 w-8 text-cyan-100" />
          </div>
          <p className="text-lg font-medium">Drag and drop a PDF here or click to browse</p>
          <p className="mt-2 text-sm text-cyan-100/90">PDF only, up to 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </button>

        {loading && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 text-sm text-cyan-50">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            PrithviAI is reading your document...
          </div>
        )}

        {!loading && result?.filledFields?.length > 0 && (
          <div className="rounded-2xl bg-emerald-400/15 px-4 py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-200" />
              <div>
                <p className="text-sm font-semibold text-white">Found {result.filledFields.length} fields in your document</p>
                <p className="text-xs text-emerald-100/90">Review each highlighted field before continuing.</p>
              </div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-amber-400/15 px-4 py-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-200" />
              <div>
                <p className="text-sm font-semibold text-white">AI auto-fill could not complete</p>
                <p className="text-xs text-amber-50/90">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 text-xs text-cyan-100/90 md:grid-cols-3">
          <div className="rounded-2xl bg-white/8 p-3">
            <FileText className="mb-2 h-4 w-4" />
            Digital PDFs work well because the text is directly extractable in the browser.
          </div>
          <div className="rounded-2xl bg-white/8 p-3">
            <Sparkles className="mb-2 h-4 w-4" />
            Extracted values are highlighted in yellow so they are easy to verify during judging.
          </div>
          <div className="rounded-2xl bg-white/8 p-3">
            <TriangleAlert className="mb-2 h-4 w-4" />
            Scanned PDFs may return little or no text, in which case manual form entry remains available.
          </div>
        </div>
      </div>
    </section>
  )
}
