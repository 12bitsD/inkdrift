import { useEffect } from 'react'
import type { RunMetadata, RunRecord } from '../../shared/types'

type KeyboardShortcutsProps = {
  historyOpen: boolean
  settingsOpen: boolean
  codeRun: RunRecord | null
  current: RunRecord | null
  deleting: boolean
  visibleRuns: RunMetadata[]
  closeHistory: () => void
  generate: () => Promise<void>
  setAsBaseline: () => Promise<void>
  selectRun: (runId: string) => Promise<void>
}

function generateShortcut(
  event: KeyboardEvent,
  generate: () => Promise<void>,
): boolean {
  if ((!event.metaKey && !event.ctrlKey) || event.key !== 'Enter') {
    return false
  }
  event.preventDefault()
  void generate()
  return true
}

function baselineShortcut(
  event: KeyboardEvent,
  setAsBaseline: () => Promise<void>,
): boolean {
  if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== 'b') {
    return false
  }
  event.preventDefault()
  void setAsBaseline()
  return true
}

function shortcutsHandled(
  event: KeyboardEvent,
  generate: () => Promise<void>,
  setAsBaseline: () => Promise<void>,
): boolean {
  return generateShortcut(event, generate)
    || baselineShortcut(event, setAsBaseline)
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function nextRunIndex(
  event: KeyboardEvent,
  runs: RunMetadata[],
  currentId?: string,
): number | null {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
    return null
  }
  const index = runs.findIndex(run => run.id === currentId)
  const nextIndex = event.key === 'ArrowUp' ? index + 1 : index - 1
  if (nextIndex < 0 || nextIndex >= runs.length) {
    return null
  }
  return nextIndex
}

export function useKeyboardShortcuts({
  historyOpen,
  settingsOpen,
  codeRun,
  current,
  deleting,
  visibleRuns,
  closeHistory,
  generate,
  setAsBaseline,
  selectRun,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && historyOpen) {
        closeHistory()
        return
      }
      if (settingsOpen || codeRun || event.defaultPrevented) {
        return
      }
      if (shortcutsHandled(event, generate, setAsBaseline)) {
        return
      }
      if (deleting || isTextInput(event.target)) {
        return
      }
      const index = nextRunIndex(event, visibleRuns, current?.id)
      if (index === null) {
        return
      }
      event.preventDefault()
      void selectRun(visibleRuns[index]!.id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [
    closeHistory,
    codeRun,
    current,
    deleting,
    generate,
    historyOpen,
    selectRun,
    setAsBaseline,
    settingsOpen,
    visibleRuns,
  ])
}
