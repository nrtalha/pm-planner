// plotly.js-basic-dist-min ships without types; this is the one function the app uses.
declare module 'plotly.js-basic-dist-min' {
  type Figure = { data: unknown[]; layout?: Record<string, unknown> }
  type ImageOptions = { format: 'png' | 'svg' | 'jpeg' | 'webp'; width?: number; height?: number; scale?: number }
  /** Renders the figure off-screen and resolves to a data: URL. */
  export function toImage(figure: Figure, options: ImageOptions): Promise<string>
}
