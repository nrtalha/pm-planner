/** Static class names so Tailwind generates them. Index matches lib/gantt colorIndex. */
export const PHASE_BG = ['bg-phase-1', 'bg-phase-2', 'bg-phase-3', 'bg-phase-4', 'bg-phase-5', 'bg-phase-6'] as const

export function phaseBg(index: number): string {
  return PHASE_BG[index % PHASE_BG.length]!
}
