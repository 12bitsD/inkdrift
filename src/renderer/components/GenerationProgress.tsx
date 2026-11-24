import { useEffect, useState } from 'react'
import type { ActiveGeneration } from '../types'

function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1000
  const digits = seconds >= 10 ? 0 : 1
  return `${seconds.toFixed(digits)}s`
}

export function GenerationProgress({ run }: { run: ActiveGeneration }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - run.startedAt)
  useEffect(() => {
    const update = () => setElapsed(Date.now() - run.startedAt)
    update()
    const timer = window.setInterval(update, 200)
    return () => window.clearInterval(timer)
  }, [run.startedAt])
  const ratio = Math.min(1, elapsed / run.timeoutMs)
  const elapsedSeconds = Math.floor(elapsed / 1000)
  const timeoutSeconds = Math.round(run.timeoutMs / 1000)
  const elapsedText = formatSeconds(elapsed)
  const timeoutText = formatSeconds(run.timeoutMs)
  return (
    <div
      className="generation-progress"
      role="progressbar"
      aria-label="Generation time budget"
      aria-valuemin={0}
      aria-valuemax={timeoutSeconds}
      aria-valuenow={Math.min(elapsedSeconds, timeoutSeconds)}
      aria-valuetext={`${elapsedText} elapsed of ${timeoutText} timeout`}
    >
      <div className="generation-progress-meta">
        <span>Elapsed {elapsedText}</span>
        <span>Timeout {timeoutText}</span>
      </div>
      <div className="generation-progress-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${String(ratio)})` }} />
      </div>
    </div>
  )
}
