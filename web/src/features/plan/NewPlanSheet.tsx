import { LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError, generatePlan } from '@/lib/api'
import { formatElapsed, planNameFromFile, todayIso } from '@/lib/format'
import type { LoadedPlan } from '@/lib/types'

import { FileDropzone } from './FileDropzone'
import { FormError } from './FormError'

type NewPlanSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoaded: (plan: LoadedPlan) => void
}

const MAX_TARGET_WEEKS = 104

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function NewPlanSheet({ open, onOpenChange, onLoaded }: NewPlanSheetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [startDate, setStartDate] = useState(todayIso)
  const [targetWeeks, setTargetWeeks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  const cancel = () => {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
  }

  const onOpenChangeSafe = (next: boolean) => {
    if (!next && busy) cancel()
    onOpenChange(next)
  }

  const chooseFile = (chosen: File) => {
    setError(isPdf(chosen) ? null : 'Choose a PDF file.')
    setFile(isPdf(chosen) ? chosen : null)
  }

  const weeks = targetWeeks.trim() === '' ? 0 : Number(targetWeeks)
  const weeksInvalid = !Number.isFinite(weeks) || weeks < 0 || weeks > MAX_TARGET_WEEKS

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || weeksInvalid || !startDate) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setElapsed(0)
    setError(null)
    try {
      const state = await generatePlan({ file, startDate, targetWeeks: weeks }, abort.signal)
      onLoaded({ name: planNameFromFile(file.name), state })
      setFile(null)
      setTargetWeeks('')
      onOpenChange(false)
    } catch (err) {
      if (abort.signal.aborted) return
      setError(err instanceof ApiError ? err.message : 'Something went wrong while generating the plan.')
    } finally {
      if (controller.current === abort) {
        controller.current = null
        setBusy(false)
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChangeSafe}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col" aria-busy={busy}>
          <SheetHeader className="p-6 pb-2">
            <p className="eyebrow">New plan</p>
            <SheetTitle>Plan from a SOW</SheetTitle>
            <SheetDescription>
              Upload a statement of work. Claude reads it with your subscription and builds the phases, sprints
              and risks.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-4">
            <FileDropzone
              label="SOW or project charter"
              accept=".pdf,application/pdf"
              hint="PDF, up to 50 MB"
              file={file}
              onFile={chooseFile}
              disabled={busy}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-start">Project start date</Label>
              <Input
                id="new-start"
                type="date"
                required
                value={startDate}
                disabled={busy}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-weeks">Target timeline (weeks)</Label>
              <Input
                id="new-weeks"
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_TARGET_WEEKS}
                step={1}
                placeholder="Use the SOW's timeline"
                value={targetWeeks}
                disabled={busy}
                aria-invalid={weeksInvalid || undefined}
                aria-describedby="new-weeks-hint"
                onChange={(event) => setTargetWeeks(event.target.value)}
              />
              <p id="new-weeks-hint" className="text-xs text-muted-foreground">
                Leave empty to keep the SOW's timeline, or enter weeks to compress or expand the plan.
              </p>
            </div>
            <FormError message={error} />
          </div>

          <SheetFooter className="border-t border-border p-6">
            {busy ? (
              <div className="flex flex-col gap-3">
                <p role="status" className="flex items-center gap-2 text-sm">
                  <LoaderCircle className="size-4 animate-spin text-label" aria-hidden="true" />
                  Claude is reading the SOW… <span className="font-mono text-muted-foreground">{formatElapsed(elapsed)}</span>
                </p>
                <p className="text-xs text-muted-foreground">Usually under a minute. Larger SOWs take longer.</p>
                <Button type="button" variant="outline" size="lg" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button type="submit" size="lg" disabled={!file || weeksInvalid || !startDate}>
                <Sparkles data-icon="inline-start" />
                Generate plan
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
