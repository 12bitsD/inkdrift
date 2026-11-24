import { DEFAULT_PROMPT } from '../../shared/types'
import type { ModelProfile, RunMetadata, RunRecord } from '../../shared/types'
import type { ActiveGeneration } from '../types'
import { Icon } from './Icon'
import { RunPanel } from './RunPanel'

type WorkspaceProps = {
  prompt: string
  deleting: boolean
  error: string
  notice: string
  zoom: number
  baseline: RunRecord | null
  current: RunRecord | null
  activeProfile?: ModelProfile
  pendingGeneration?: ActiveGeneration
  pendingDelete: string | null
  inert: boolean
  onPromptChange: (value: string) => void
  onPersistPrompt: () => void
  onDismissMessage: () => void
  onZoomChange: (value: number) => void
  onCode: (run: RunRecord) => void
  onDelete: (run: RunMetadata) => Promise<void>
  onSetBaseline: () => void
}

function PromptStrip({ prompt, deleting, onPromptChange, onPersistPrompt }: {
  prompt: string
  deleting: boolean
  onPromptChange: (value: string) => void
  onPersistPrompt: () => void
}) {
  return (
    <section className="prompt-strip" aria-labelledby="prompt-heading">
      <div className="prompt-number">01</div>
      <div className="prompt-content">
        <div className="prompt-heading">
          <div>
            <h2 id="prompt-heading">The brief</h2>
            <p>One prompt. Many frames. Two points in time.</p>
          </div>
          <span
            className="prompt-shortcut"
            aria-label="Generate with Control or Command plus Enter"
          >
            <kbd>Ctrl / Cmd</kbd><kbd>Enter</kbd>
          </span>
        </div>
        <label className="visually-hidden" htmlFor="svg-prompt">
          SVG generation prompt
        </label>
        <textarea
          id="svg-prompt"
          value={prompt}
          onChange={event => onPromptChange(event.target.value)}
          disabled={deleting}
          rows={2}
          maxLength={100000}
          spellCheck={false}
          onBlur={onPersistPrompt}
        />
      </div>
      <button
        className="icon-button prompt-reset"
        type="button"
        aria-label="Reset to the Charmander prompt"
        onClick={() => onPromptChange(DEFAULT_PROMPT)}
        disabled={deleting}
      >
        <Icon name="refresh" />
      </button>
    </section>
  )
}

function AppMessage({ error, notice, onDismiss }: {
  error: string
  notice: string
  onDismiss: () => void
}) {
  if (!error && !notice) {
    return null
  }
  const className = error ? 'app-message error' : 'app-message'
  return (
    <div className={className} role={error ? 'alert' : 'status'}>
      <span>{error || notice}</span>
      <button type="button" aria-label="Dismiss message" onClick={onDismiss}>
        <Icon name="close" size={15} />
      </button>
    </div>
  )
}

function ViewControls({ zoom, onZoomChange }: {
  zoom: number
  onZoomChange: (value: number) => void
}) {
  return (
    <div className="view-controls" aria-label="Comparison zoom controls">
      <span className="eyebrow">VIEW</span>
      <button
        className="icon-button"
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={zoom <= 50}
        onClick={() => onZoomChange(Math.max(50, zoom - 25))}
      >
        −
      </button>
      <output className="zoom-value" aria-label="Zoom level">{zoom}%</output>
      <button
        className="icon-button"
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={zoom >= 200}
        onClick={() => onZoomChange(Math.min(200, zoom + 25))}
      >
        +
      </button>
      <button
        className="button secondary fit-button"
        type="button"
        disabled={zoom === 100}
        onClick={() => onZoomChange(100)}
      >
        Fit
      </button>
    </div>
  )
}

function CurrentActions({ current, baseline, deleting, onSetBaseline }: {
  current: RunRecord | null
  baseline: RunRecord | null
  deleting: boolean
  onSetBaseline: () => void
}) {
  if (current?.status !== 'succeeded' || baseline?.id === current.id) {
    return null
  }
  return (
    <div className="current-actions">
      <button
        className="button secondary"
        type="button"
        title="Set as baseline (Ctrl/Cmd+B)"
        disabled={deleting}
        onClick={onSetBaseline}
      >
        <Icon name="baseline" /> Set as baseline
      </button>
    </div>
  )
}

export function Workspace({
  prompt,
  deleting,
  error,
  notice,
  zoom,
  baseline,
  current,
  activeProfile,
  pendingGeneration,
  pendingDelete,
  inert,
  onPromptChange,
  onPersistPrompt,
  onDismissMessage,
  onZoomChange,
  onCode,
  onDelete,
  onSetBaseline,
}: WorkspaceProps) {
  const currentEmptyTitle = activeProfile
    ? 'Your next SVG lands here'
    : 'Choose a model to begin'
  const currentEmptyDescription = activeProfile
    ? 'Generate once, compare twice. Nothing is scored automatically.'
    : 'Open settings to add an OpenAI-compatible or Anthropic model profile.'
  return (
    <main className="workspace" id="workspace" inert={inert}>
      <PromptStrip
        prompt={prompt}
        deleting={deleting}
        onPromptChange={onPromptChange}
        onPersistPrompt={onPersistPrompt}
      />
      <AppMessage error={error} notice={notice} onDismiss={onDismissMessage} />
      <div className="comparison-heading">
        <div className="comparison-title">
          <span className="prompt-number">02</span>
          <div>
            <p className="eyebrow">THE COMPARISON</p>
            <h2>Frame by frame.</h2>
          </div>
        </div>
        <ViewControls zoom={zoom} onZoomChange={onZoomChange} />
      </div>
      <div className="comparison-grid">
        <RunPanel
          title="BASELINE"
          record={baseline}
          emptyTitle="No baseline for this brief"
          emptyDescription="Generate an SVG you like, then explicitly save it as your visual reference."
          onCode={onCode}
          emptyProfileName={current?.profileName ?? activeProfile?.name}
          zoom={zoom}
        />
        <RunPanel
          title="CURRENT"
          record={current}
          busyRun={pendingGeneration}
          emptyTitle={currentEmptyTitle}
          emptyDescription={currentEmptyDescription}
          onCode={onCode}
          emptyProfileName={activeProfile?.name}
          zoom={zoom}
          onDelete={onDelete}
          deletePending={pendingDelete === current?.id}
          deleting={deleting}
          action={(
            <CurrentActions
              current={current}
              baseline={baseline}
              deleting={deleting}
              onSetBaseline={onSetBaseline}
            />
          )}
        />
      </div>
      <footer className="workspace-footer">
        <span>NO JUDGE</span><span>NO SCORE</span><span>JUST THE FRAMES</span>
      </footer>
    </main>
  )
}
