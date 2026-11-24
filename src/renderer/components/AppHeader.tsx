import type { ActiveGeneration } from '../types'
import { Icon } from './Icon'

type AppHeaderProps = {
  activeRunCount: number
  cancelableGeneration?: ActiveGeneration
  canGenerate: boolean
  deleting: boolean
  historyOpen: boolean
  inert: boolean
  historyTrigger: React.RefObject<HTMLButtonElement | null>
  onOpenHistory: () => void
  onOpenSettings: () => void
  onGenerate: () => void
  onCancel: (profileId: string) => void
}

function Brand() {
  return (
    <div className="brand-block">
      <svg className="brand-mark" viewBox="0 0 36 36" aria-hidden="true">
        <rect x="1" y="1" width="34" height="34" rx="8" fill="currentColor" />
        <rect
          x="8"
          y="11"
          width="13"
          height="16"
          fill="none"
          stroke="#f7f7f5"
          opacity=".42"
        />
        <rect x="15" y="7" width="13" height="16" fill="#151515" stroke="#f7f7f5" />
        <rect x="24" y="25" width="5" height="5" fill="#f7f7f5" />
      </svg>
      <div>
        <h1>inkdrift<span className="brand-period">.</span></h1>
        <p>
          <span>A visual canary for language models</span>
          <span className="brand-edition">SVG / 001</span>
        </p>
      </div>
    </div>
  )
}

function RunSummary({ count }: { count: number }) {
  if (count === 0) {
    return <div className="header-run-summary">LOCAL ONLY</div>
  }
  return (
    <div className="header-run-summary" aria-label="Active generations">
      <span className="local-dot" />
      {count} running
    </div>
  )
}

export function AppHeader({
  activeRunCount,
  cancelableGeneration,
  canGenerate,
  deleting,
  historyOpen,
  inert,
  historyTrigger,
  onOpenHistory,
  onOpenSettings,
  onGenerate,
  onCancel,
}: AppHeaderProps) {
  return (
    <header className="app-header" inert={inert}>
      <Brand />
      <div className="header-actions">
        <button
          ref={historyTrigger}
          className="icon-button history-toggle"
          type="button"
          aria-label="Open models and history"
          aria-expanded={historyOpen}
          aria-controls="history-sidebar"
          onClick={onOpenHistory}
        >
          <Icon name="history" size={20} />
        </button>
        <RunSummary count={activeRunCount} />
        <button
          className="icon-button settings-button"
          type="button"
          aria-label="Open model settings"
          disabled={deleting}
          onClick={onOpenSettings}
        >
          <Icon name="settings" size={20} />
        </button>
        {cancelableGeneration ? (
          <button
            className="button primary generate-button"
            type="button"
            title={`Cancel ${cancelableGeneration.profileName}`}
            disabled={deleting}
            onClick={() => onCancel(cancelableGeneration.profileId)}
          >
            <Icon name="cancel" /> Cancel
          </button>
        ) : (
          <button
            className="button primary generate-button"
            type="button"
            title="Generate (Ctrl/Cmd+Enter)"
            disabled={!canGenerate || deleting}
            onClick={onGenerate}
          >
            <Icon name="generate" /> Generate
          </button>
        )}
      </div>
    </header>
  )
}
