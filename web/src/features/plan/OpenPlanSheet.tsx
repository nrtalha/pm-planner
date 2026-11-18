import { FolderOpen, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'

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
import { ApiError, openPlan } from '@/lib/api'
import { formatDate, planNameFromFile, todayIso } from '@/lib/format'
import { isPlanFile, type LoadedPlan, type PlanFile } from '@/lib/types'

import { FileDropzone } from './FileDropzone'
import { FormError } from './FormError'

type OpenPlanSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoaded: (plan: LoadedPlan) => void
}

const MAX_JSON_BYTES = 5 * 1024 * 1024

type Chosen = { file: File; contents: unknown; saved: PlanFile | null }

function fallbackName(file: File) {
  return file.name.toLowerCase() === 'plan.json' ? 'Saved plan' : planNameFromFile(file.name)
}

export function OpenPlanSheet({ open, onOpenChange, onLoaded }: OpenPlanSheetProps) {
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [startDate, setStartDate] = useState(todayIso)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const chooseFile = async (file: File) => {
    setChosen(null)
    if (!file.name.toLowerCase().endsWith('.json') || file.size > MAX_JSON_BYTES) {
      setError('Choose a plan.json file (up to 5 MB).')
      return
    }
    let contents: unknown
    try {
      contents = JSON.parse(await file.text())
    } catch {
      setError("This file isn't valid JSON. Choose a plan.json exported from the app.")
      return
    }
    setError(null)
    setChosen({ file, contents, saved: isPlanFile(contents) ? contents : null })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!chosen || (!chosen.saved && !startDate)) return
    setBusy(true)
    setError(null)
    try {
      const state = await openPlan(chosen.contents, startDate)
      onLoaded({ name: chosen.saved?.name?.trim() || fallbackName(chosen.file), state })
      setChosen(null)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong while opening the plan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col" aria-busy={busy}>
          <SheetHeader className="p-6 pb-2">
            <p className="eyebrow">Open plan</p>
            <SheetTitle>Reopen a saved plan</SheetTitle>
            <SheetDescription>Load a plan.json you downloaded from the Export center.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-4">
            <FileDropzone
              label="Saved plan"
              accept=".json,application/json"
              hint="plan.json, up to 5 MB"
              file={chosen?.file ?? null}
              onFile={chooseFile}
              disabled={busy}
            />
            {chosen?.saved ? (
              <p role="status" className="rounded-xl bg-accent px-3 py-2.5 text-sm">
                This plan includes your edits. It reopens exactly as saved, starting{' '}
                {formatDate(chosen.saved.schedule.start_date)}.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="open-start">Project start date</Label>
                <Input
                  id="open-start"
                  type="date"
                  required
                  value={startDate}
                  disabled={busy}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
            )}
            <FormError message={error} />
          </div>

          <SheetFooter className="border-t border-border p-6">
            <Button type="submit" size="lg" disabled={!chosen || (!chosen.saved && !startDate) || busy}>
              {busy ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <FolderOpen data-icon="inline-start" />
              )}
              Open plan
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
