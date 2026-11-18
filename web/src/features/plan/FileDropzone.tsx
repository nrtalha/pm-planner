import { FileCheck2, Upload } from 'lucide-react'
import { useId, useState, type DragEvent } from 'react'

import { cn } from '@/lib/utils'

type FileDropzoneProps = {
  label: string
  /** e.g. ".pdf,application/pdf" */
  accept: string
  hint: string
  file: File | null
  onFile: (file: File) => void
  disabled?: boolean
  invalid?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** A real file input (keyboard and screen-reader friendly) with drag-and-drop on top. */
export function FileDropzone({ label, accept, hint, file, onFile, disabled, invalid }: FileDropzoneProps) {
  const id = useId()
  const [dragging, setDragging] = useState(false)

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped && !disabled) onFile(dropped)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
      </span>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-input bg-field px-4 py-6 text-center transition-colors',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          dragging && 'border-ring bg-accent',
          invalid && 'border-destructive',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          aria-invalid={invalid || undefined}
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            if (chosen) onFile(chosen)
            event.target.value = ''
          }}
        />
        {file ? (
          <>
            <FileCheck2 className="size-6 text-label" aria-hidden="true" />
            <span className="max-w-full truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatSize(file.size)} · click or drop to replace</span>
          </>
        ) : (
          <>
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">
              Drop a file here or <span className="font-semibold text-label">browse</span>
            </span>
          </>
        )}
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </span>
      </label>
    </div>
  )
}
