import { useEffect, useState } from 'react'
import type { RunMetadata } from '../../shared/types'
import { formatDate } from '../utils'
import { DeleteRunButton } from './DeleteRunButton'
import { Icon } from './Icon'
import { SvgImage } from './SvgImage'

type HistoryEntryProps = {
  run: RunMetadata
  selected: boolean
  onSelect: () => void
  onDelete: (run: RunMetadata) => Promise<void>
  deletePending: boolean
  deleting: boolean
}

function HistoryThumb({ run }: { run: RunMetadata }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (run.hasSvg) {
      window.inkdrift.getRunSvg(run.id).then(value => {
        if (active) {
          setSvg(value)
        }
      }).catch(() => {})
    }
    return () => { active = false }
  }, [run.id, run.hasSvg])
  const className = svg ? 'history-thumb' : 'history-thumb empty'
  const icon = run.status === 'succeeded' ? 'history' : 'close'
  return (
    <span className={className}>
      {svg ? <SvgImage svg={svg} alt="" /> : <Icon name={icon} size={20} />}
    </span>
  )
}

export function HistoryEntry({
  run,
  selected,
  onSelect,
  onDelete,
  deletePending,
  deleting,
}: HistoryEntryProps) {
  const entryClass = selected ? 'history-entry selected' : 'history-entry'
  const markClass = run.status === 'succeeded' ? 'run-mark success' : 'run-mark'
  return (
    <li className="history-item">
      <button
        type="button"
        className={entryClass}
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
      >
        <HistoryThumb run={run} />
        <span className="history-copy">
          <strong>{run.profileName}</strong>
          <small className="history-prompt">{run.prompt}</small>
          <small className="history-meta">
            {run.modelId} · {formatDate(run.createdAt)}
          </small>
        </span>
        <span className={markClass} aria-label={run.status} />
      </button>
      <DeleteRunButton
        run={run}
        pending={deletePending}
        deleting={deleting}
        onDelete={onDelete}
        target={`${run.profileName} run`}
        history
      />
    </li>
  )
}
