import { vi } from 'vitest'

/** Capture the file names the app "downloads" (anchor clicks) instead of navigating jsdom. */
export function captureDownloads() {
  const names: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download)
  })
  return names
}

export function fileResponse(body: string, filename: string, type = 'text/csv'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"` },
  })
}
