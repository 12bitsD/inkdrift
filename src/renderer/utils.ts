import type { RunRecord } from '../shared/types'

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${String(milliseconds)} ms`
  }
  return `${(milliseconds / 1000).toFixed(1)} s`
}

export function downloadSvg(record: RunRecord): void {
  if (!record.svg) {
    return
  }
  const blob = new Blob([record.svg], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `inkdrift-${record.id}.svg`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
