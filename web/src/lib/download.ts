/** Hand a file to the browser's normal download flow. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before the URL is released.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 'attachment; filename="gantt_grid.xlsx"' → 'gantt_grid.xlsx' */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header && /filename="?([^";]+)"?/i.exec(header)
  return match?.[1]?.trim() || fallback
}
