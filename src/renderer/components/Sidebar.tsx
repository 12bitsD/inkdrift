import type { ModelProfile, RunMetadata, RunRecord } from '../../shared/types'
import type { ActiveGeneration } from '../types'
import { EmptyArt } from './EmptyArt'
import { HistoryEntry } from './HistoryEntry'
import { Icon } from './Icon'

type SidebarProps = {
  profiles: ModelProfile[]
  activeProfileId: string | null
  activeGenerations: Record<string, ActiveGeneration>
  runs: RunMetadata[]
  visibleRuns: RunMetadata[]
  filteredRunsCount: number
  current: RunRecord | null
  historyFilter: string
  historyOpen: boolean
  compactHistory: boolean
  pendingDelete: string | null
  deleting: boolean
  historyClose: React.RefObject<HTMLButtonElement | null>
  onSelectProfile: (profileId: string) => void
  onSelectRun: (runId: string) => void
  onDeleteRun: (run: RunMetadata) => Promise<void>
  onHistoryFilter: (value: string) => void
  onLoadMore: () => void
  onCloseHistory: () => void
}

function SidebarHeading({ count, historyClose, onCloseHistory }: {
  count: number
  historyClose: React.RefObject<HTMLButtonElement | null>
  onCloseHistory: () => void
}) {
  return (
    <div className="sidebar-heading">
      <div>
        <p className="eyebrow">PROFILES</p>
        <h2 id="models-title">
          Models <span>{count.toString().padStart(2, '0')}</span>
        </h2>
      </div>
      <button
        ref={historyClose}
        className="icon-button history-close"
        type="button"
        aria-label="Close models and history"
        onClick={onCloseHistory}
      >
        <Icon name="close" size={18} />
      </button>
      <Icon name="settings" size={20} />
    </div>
  )
}

function ModelList({
  profiles,
  activeProfileId,
  activeGenerations,
  deleting,
  onSelectProfile,
}: {
  profiles: ModelProfile[]
  activeProfileId: string | null
  activeGenerations: Record<string, ActiveGeneration>
  deleting: boolean
  onSelectProfile: (profileId: string) => void
}) {
  if (profiles.length === 0) {
    return (
      <div className="models-empty">
        <p>No model profiles yet. Open settings to add one.</p>
      </div>
    )
  }
  return (
    <ul className="model-list">
      {profiles.map(profile => {
        const running = activeGenerations[profile.id]
        const active = profile.id === activeProfileId
        const className = active ? 'model-choice active' : 'model-choice'
        return (
          <li key={profile.id}>
            <button
              type="button"
              className={className}
              aria-current={active ? 'true' : undefined}
              disabled={deleting}
              onClick={() => onSelectProfile(profile.id)}
            >
              <span className="model-choice-copy">
                <strong>{profile.name}</strong>
                <small>{profile.modelId}</small>
              </span>
              {running ? (
                <span className="model-running">
                  <span
                    className="generation-spinner small"
                    aria-hidden="true"
                  />
                  Drawing
                </span>
              ) : (
                <span className="model-provider">{profile.providerType}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function HistoryList({
  runs,
  current,
  pendingDelete,
  deleting,
  onSelectRun,
  onDeleteRun,
}: {
  runs: RunMetadata[]
  current: RunRecord | null
  pendingDelete: string | null
  deleting: boolean
  onSelectRun: (runId: string) => void
  onDeleteRun: (run: RunMetadata) => Promise<void>
}) {
  if (runs.length === 0) {
    return (
      <div className="history-empty">
        <EmptyArt variant="layers" />
        <h3>No frames yet</h3>
        <p>
          Your generated SVGs will collect here, with the model and time
          attached.
        </p>
      </div>
    )
  }
  return (
    <ul className="history-list">
      {runs.map(run => (
        <HistoryEntry
          key={run.id}
          run={run}
          selected={current?.id === run.id}
          onSelect={() => onSelectRun(run.id)}
          onDelete={onDeleteRun}
          deletePending={pendingDelete === run.id}
          deleting={deleting}
        />
      ))}
    </ul>
  )
}

export function Sidebar({
  profiles,
  activeProfileId,
  activeGenerations,
  runs,
  visibleRuns,
  filteredRunsCount,
  current,
  historyFilter,
  historyOpen,
  compactHistory,
  pendingDelete,
  deleting,
  historyClose,
  onSelectProfile,
  onSelectRun,
  onDeleteRun,
  onHistoryFilter,
  onLoadMore,
  onCloseHistory,
}: SidebarProps) {
  const asideClass = historyOpen
    ? 'history-sidebar drawer-open'
    : 'history-sidebar'
  return (
    <aside
      id="history-sidebar"
      className={asideClass}
      aria-labelledby="models-title"
      inert={compactHistory && !historyOpen}
      role={compactHistory ? 'dialog' : undefined}
      aria-modal={compactHistory && historyOpen ? true : undefined}
    >
      <SidebarHeading
        count={profiles.length}
        historyClose={historyClose}
        onCloseHistory={onCloseHistory}
      />
      <ModelList
        profiles={profiles}
        activeProfileId={activeProfileId}
        activeGenerations={activeGenerations}
        deleting={deleting}
        onSelectProfile={onSelectProfile}
      />
      <div className="history-heading">
        <div>
          <p className="eyebrow">ARCHIVE</p>
          <h2 id="history-title">
            History <span>{runs.length.toString().padStart(2, '0')}</span>
          </h2>
        </div>
        <Icon name="history" size={20} />
      </div>
      <search className="history-search">
        <label htmlFor="history-filter">Filter by model</label>
        <select
          id="history-filter"
          value={historyFilter}
          onChange={event => onHistoryFilter(event.target.value)}
        >
          <option value="all">All models</option>
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>
      </search>
      <HistoryList
        runs={visibleRuns}
        current={current}
        pendingDelete={pendingDelete}
        deleting={deleting}
        onSelectRun={onSelectRun}
        onDeleteRun={onDeleteRun}
      />
      {visibleRuns.length < filteredRunsCount && (
        <div className="history-more">
          <span>Showing {visibleRuns.length} of {filteredRunsCount}</span>
          <button
            className="button secondary"
            type="button"
            onClick={onLoadMore}
          >
            Load 50 more
          </button>
        </div>
      )}
      <footer className="sidebar-footer">
        <span className="local-dot" />LOCAL ONLY
      </footer>
    </aside>
  )
}
