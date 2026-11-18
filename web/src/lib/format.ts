const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** '2026-04-24' → '24 Apr 2026'. Dates are calendar days, so they are read as UTC to avoid shifts. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date)
}

/** Today in the viewer's time zone, as YYYY-MM-DD (the value an <input type="date"> uses). */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Document acronyms that should stay upper-case in plan names. */
const ACRONYMS = new Set(['sow', 'msa', 'rfp', 'rfq', 'prd', 'po', 'nda', 'sla', 'uat', 'erp', 'pos', 'qa', 'ui', 'ux', 'api'])

/** 'northwind-outfitters_sow.pdf' → 'Northwind Outfitters SOW'. Words already capitalised are kept. */
export function planNameFromFile(filename: string): string {
  const words = filename
    .replace(/\.[^.]+$/, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => {
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase()
      return word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word
    })
  return words.join(' ') || 'Untitled plan'
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/** 75 → '1:15' */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
