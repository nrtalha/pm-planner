/**
 * Priority dots. Colours differ in lightness as well as hue, so they stay distinguishable
 * for colour-blind viewers; the priority name is always shown next to the dot.
 */
const DOT: Record<string, string> = {
  Urgent: 'bg-[#dc2626]',
  High: 'bg-[#f59e0b]',
  Normal: 'bg-[#3b82f6]',
  Low: 'bg-[#94a3b8]',
}

export function priorityDot(priority: string | null | undefined): string {
  return (priority && DOT[priority]) || 'bg-muted-foreground/50'
}
