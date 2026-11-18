import { describe, expect, it } from 'vitest'

import { formatDate, formatElapsed, planNameFromFile, plural, todayIso } from '@/lib/format'

describe('format helpers', () => {
  it('formats ISO dates as "24 Apr 2026" without time-zone shifts', () => {
    expect(formatDate('2026-04-24')).toBe('24 Apr 2026')
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })

  it('gives today as YYYY-MM-DD in local time', () => {
    expect(todayIso(new Date(2026, 10, 18, 23, 30))).toBe('2026-11-18')
  })

  it('turns file names into plan names', () => {
    expect(planNameFromFile('northwind-outfitters_sow.pdf')).toBe('Northwind Outfitters SOW')
    expect(planNameFromFile('Acme iOS rebuild - MSA v2.pdf')).toBe('Acme iOS Rebuild MSA V2')
    expect(planNameFromFile('.pdf')).toBe('Untitled plan')
  })

  it('pluralises and formats elapsed time', () => {
    expect(plural(1, 'day')).toBe('1 day')
    expect(plural(3, 'day')).toBe('3 days')
    expect(formatElapsed(75)).toBe('1:15')
    expect(formatElapsed(5.9)).toBe('0:05')
  })
})
