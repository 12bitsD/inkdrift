import { useEffect, useRef, useState } from 'react'
import type {
  ModelProfile,
  ProfileInput,
  ProviderType,
} from '../../shared/types'
import { Icon } from './Icon'

const PROVIDER_DEFAULTS: Record<
  ProviderType,
  { name: string; baseUrl: string; modelId: string }
> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    modelId: 'claude-sonnet-4-5',
  },
}

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}

function blankProfile(): ProfileInput {
  return {
    ...PROVIDER_DEFAULTS.openai,
    id: crypto.randomUUID(),
    providerType: 'openai',
    timeoutMs: 120_000,
    maxOutputTokens: 8_192,
    apiKey: '',
  }
}

function apiKeyPlaceholder(
  draft: ProfileInput,
  profiles: ModelProfile[],
): string {
  if (profiles.some(profile => profile.id === draft.id)) {
    return 'Leave blank to keep the saved key'
  }
  if (draft.forkFromId) {
    return 'Leave blank to copy the saved key'
  }
  return 'Paste a provider API key'
}

type UpdateProfile = <K extends keyof ProfileInput>(
  key: K,
  value: ProfileInput[K],
) => void

function ProfileSidebar({ profiles, draft, onSelect }: {
  profiles: ModelProfile[]
  draft: ProfileInput
  onSelect: (profile?: ModelProfile) => void
}) {
  return (
    <aside className="profile-list" aria-label="Saved profiles">
      <button
        className="new-profile-button"
        type="button"
        onClick={() => onSelect()}
      >
        <Icon name="plus" /> New profile
      </button>
      <ul>
        {profiles.map(profile => {
          const className = profile.id === draft.id
            ? 'profile-choice active'
            : 'profile-choice'
          return (
            <li key={profile.id}>
              <button
                type="button"
                className={className}
                onClick={() => onSelect(profile)}
              >
                <span>{profile.name}</span>
                <small>{profile.modelId}</small>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="profile-note">
        Profiles and run history stay on this device. Prompts are sent to the
        provider you configure.
      </p>
    </aside>
  )
}

function ProfileFields({ draft, profiles, modelIdRef, onUpdate, onProvider }: {
  draft: ProfileInput
  profiles: ModelProfile[]
  modelIdRef: React.RefObject<HTMLInputElement | null>
  onUpdate: UpdateProfile
  onProvider: (providerType: ProviderType) => void
}) {
  const anthropic = draft.providerType === 'anthropic'
  const baseUrlLabel = anthropic
    ? 'Anthropic Base URL'
    : 'OpenAI-compatible Base URL'
  const endpoint = anthropic ? '/v1/messages' : '/chat/completions'
  const temperatureMax = anthropic ? 1 : 2
  const temperatureRange = anthropic ? '0–1' : '0–2'
  return (
    <>
      <div className="field">
        <label htmlFor="profile-name">Profile name</label>
        <input
          id="profile-name"
          name="name"
          value={draft.name}
          onChange={event => onUpdate('name', event.target.value)}
          required
          maxLength={80}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="provider-type">Provider</label>
        <select
          id="provider-type"
          name="providerType"
          value={draft.providerType}
          onChange={event => onProvider(event.target.value as ProviderType)}
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="base-url">{baseUrlLabel}</label>
        <input
          id="base-url"
          name="baseUrl"
          type="url"
          value={draft.baseUrl}
          onChange={event => onUpdate('baseUrl', event.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="field-hint">
          HTTPS is required except for loopback development servers. Nextloop
          calls {endpoint}.
        </p>
      </div>
      <div className="field">
        <label htmlFor="model-id">Model ID</label>
        <input
          ref={modelIdRef}
          id="model-id"
          name="modelId"
          value={draft.modelId}
          onChange={event => onUpdate('modelId', event.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div className="field">
        <label htmlFor="api-key">API key</label>
        <input
          id="api-key"
          name="apiKey"
          type="password"
          value={draft.apiKey}
          onChange={event => onUpdate('apiKey', event.target.value)}
          placeholder={apiKeyPlaceholder(draft, profiles)}
          autoComplete="new-password"
        />
        <p className="field-hint">
          Encrypted with macOS Keychain or Windows DPAPI. Never returned to
          the UI.
        </p>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="timeout">Timeout (seconds)</label>
          <input
            id="timeout"
            name="timeoutMs"
            type="number"
            min={1}
            max={900}
            value={draft.timeoutMs / 1000}
            onChange={event => onUpdate(
              'timeoutMs',
              Number(event.target.value) * 1000,
            )}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="tokens">Max output tokens</label>
          <input
            id="tokens"
            name="maxOutputTokens"
            type="number"
            min={256}
            max={1000000}
            step={1}
            value={draft.maxOutputTokens}
            onChange={event => onUpdate(
              'maxOutputTokens',
              Number(event.target.value),
            )}
            required
          />
        </div>
      </div>
      <div className="sampling-section">
        <div className="sampling-heading">
          <p className="eyebrow">SAMPLING</p>
          <span>Optional · blank uses the provider default</span>
        </div>
        <div className="field-row three">
          <div className="field">
            <label htmlFor="temperature">Temperature</label>
            <input
              id="temperature"
              name="temperature"
              type="number"
              min={0}
              max={temperatureMax}
              step="any"
              value={draft.temperature ?? ''}
              placeholder="Provider default"
              onChange={event => onUpdate(
                'temperature',
                optionalNumber(event.target.value),
              )}
            />
            <p className="field-hint">{temperatureRange}</p>
          </div>
          <div className="field">
            <label htmlFor="top-p">Top P</label>
            <input
              id="top-p"
              name="topP"
              type="number"
              min={0}
              max={1}
              step="any"
              value={draft.topP ?? ''}
              placeholder="Provider default"
              onChange={event => onUpdate(
                'topP',
                optionalNumber(event.target.value),
              )}
            />
            <p className="field-hint">0–1</p>
          </div>
          <div className="field">
            <label htmlFor="top-k">Top K</label>
            <input
              id="top-k"
              name="topK"
              type="number"
              min={1}
              step={1}
              value={draft.topK ?? ''}
              placeholder="Provider default"
              onChange={event => onUpdate(
                'topK',
                optionalNumber(event.target.value),
              )}
            />
            <p className="field-hint">Positive integer</p>
          </div>
        </div>
        <p className="field-hint">
          Top K is native to Anthropic. For OpenAI-compatible services it is
          passed through only when set, and the service may reject it.
        </p>
      </div>
    </>
  )
}

function ProfileFormActions({
  existing,
  busy,
  confirmDelete,
  onFork,
  onRemove,
}: {
  existing: boolean
  busy: boolean
  confirmDelete: boolean
  onFork: () => void
  onRemove: () => void
}) {
  return (
    <div className="form-actions">
      {existing && (
        <>
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onFork}
          >
            <Icon name="copy" /> Fork profile
          </button>
          <button
            className="button danger-button"
            type="button"
            disabled={busy}
            onClick={onRemove}
          >
            <Icon name="trash" />
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
        </>
      )}
      <button className="button primary" type="submit" disabled={busy}>
        <Icon name="check" />{busy ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  )
}

export function SettingsDialog({ open, profiles, onClose, onSave, onDelete }: {
  open: boolean
  profiles: ModelProfile[]
  onClose: () => void
  onSave: (input: ProfileInput) => Promise<void>
  onDelete: (profileId: string) => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const modelIdRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<ProfileInput>(blankProfile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const selectProfile = (profile?: ModelProfile) => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    setDraft(profile ? { ...profile, apiKey: '' } : blankProfile())
  }

  const forkProfile = (profile: ProfileInput) => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    setDraft({
      ...profile,
      id: crypto.randomUUID(),
      name: `${profile.name} fork`,
      apiKey: '',
      forkFromId: profile.id,
    })
    window.setTimeout(() => {
      modelIdRef.current?.focus()
      modelIdRef.current?.select()
    }, 0)
  }

  const update: UpdateProfile = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }))
    setNotice('')
  }

  const selectProvider = (providerType: ProviderType) => {
    setDraft(current => {
      const previous = PROVIDER_DEFAULTS[current.providerType]
      const next = PROVIDER_DEFAULTS[providerType]
      const useDefaults = !current.baseUrl.trim()
        || current.baseUrl === previous.baseUrl
      return {
        ...current,
        providerType,
        name: current.name === previous.name ? next.name : current.name,
        baseUrl: useDefaults ? next.baseUrl : current.baseUrl,
        modelId: current.modelId === previous.modelId
          ? next.modelId
          : current.modelId,
      }
    })
    setNotice('')
  }

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(draft)
      setNotice('Profile saved. The key stays encrypted on this device.')
      setDraft(current => ({
        ...current,
        apiKey: '',
        forkFromId: undefined,
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!profiles.some(profile => profile.id === draft.id)) {
      return
    }
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onDelete(draft.id)
      selectProfile()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
    >
      <header className="dialog-header">
        <div>
          <p className="eyebrow">LOCAL CONFIGURATION</p>
          <h2 id="settings-title">Model profiles</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close settings"
          onClick={() => ref.current?.close()}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="settings-layout">
        <ProfileSidebar
          profiles={profiles}
          draft={draft}
          onSelect={selectProfile}
        />
        <form
          className="profile-form"
          onSubmit={event => { void submit(event) }}
        >
          <ProfileFields
            draft={draft}
            profiles={profiles}
            modelIdRef={modelIdRef}
            onUpdate={update}
            onProvider={selectProvider}
          />
          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message" role="status">{notice}</p>}
          <ProfileFormActions
            existing={profiles.some(profile => profile.id === draft.id)}
            busy={busy}
            confirmDelete={confirmDelete}
            onFork={() => forkProfile(draft)}
            onRemove={() => { void remove() }}
          />
        </form>
      </div>
    </dialog>
  )
}
