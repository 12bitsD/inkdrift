import { useEffect, useRef, useState } from 'react'
import type { ModelProfile, ProfileInput } from '../../shared/types'
import { Icon } from './Icon'

function blankProfile(): ProfileInput {
  return {
    id: crypto.randomUUID(),
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
    timeoutMs: 120_000,
    maxOutputTokens: 8_192,
    apiKey: '',
  }
}

export function SettingsDialog({ open, profiles, onClose, onSave, onDelete }: {
  open: boolean
  profiles: ModelProfile[]
  onClose: () => void
  onSave: (input: ProfileInput) => Promise<void>
  onDelete: (profileId: string) => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<ProfileInput>(blankProfile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const selectProfile = (profile?: ModelProfile) => {
    setError('')
    setNotice('')
    setConfirmDelete(false)
    setDraft(profile ? { ...profile, apiKey: '' } : blankProfile())
  }

  const update = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setNotice('')
  }

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(draft)
      setNotice('Profile saved. The key stays encrypted on this device.')
      setDraft(current => ({ ...current, apiKey: '' }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!profiles.some(profile => profile.id === draft.id)) return
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
    <dialog ref={ref} className="settings-dialog" aria-labelledby="settings-title" onClose={onClose}>
      <header className="dialog-header">
        <div><p className="eyebrow">LOCAL CONFIGURATION</p><h2 id="settings-title">Model profiles</h2></div>
        <button className="icon-button" type="button" aria-label="Close settings" onClick={() => ref.current?.close()}><Icon name="close" /></button>
      </header>
      <div className="settings-layout">
        <aside className="profile-list" aria-label="Saved profiles">
          <button className="new-profile-button" type="button" onClick={() => selectProfile()}><Icon name="plus" /> New profile</button>
          <ul>
            {profiles.map(profile => <li key={profile.id}>
              <button type="button" className={profile.id === draft.id ? 'profile-choice active' : 'profile-choice'} onClick={() => selectProfile(profile)}>
                <span>{profile.name}</span><small>{profile.modelId}</small>
              </button>
            </li>)}
          </ul>
          <p className="profile-note">Profiles and run history stay on this device. Prompts are sent to the provider you configure.</p>
        </aside>
        <form className="profile-form" onSubmit={event => { void submit(event) }}>
          <div className="field"><label htmlFor="profile-name">Profile name</label><input id="profile-name" name="name" value={draft.name} onChange={event => update('name', event.target.value)} required maxLength={80} autoComplete="off" /></div>
          <div className="field"><label htmlFor="base-url">OpenAI-compatible Base URL</label><input id="base-url" name="baseUrl" type="url" value={draft.baseUrl} onChange={event => update('baseUrl', event.target.value)} required autoCapitalize="none" autoCorrect="off" spellCheck={false} /><p className="field-hint">HTTPS is required except for loopback development servers.</p></div>
          <div className="field"><label htmlFor="model-id">Model ID</label><input id="model-id" name="modelId" value={draft.modelId} onChange={event => update('modelId', event.target.value)} required autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
          <div className="field"><label htmlFor="api-key">API key</label><input id="api-key" name="apiKey" type="password" value={draft.apiKey} onChange={event => update('apiKey', event.target.value)} placeholder={profiles.some(profile => profile.id === draft.id) ? 'Leave blank to keep the saved key' : 'Paste a provider API key'} autoComplete="new-password" /><p className="field-hint">Encrypted with macOS Keychain or Windows DPAPI. Never returned to the UI.</p></div>
          <div className="field-row">
            <div className="field"><label htmlFor="timeout">Timeout (seconds)</label><input id="timeout" name="timeoutMs" type="number" min={1} max={900} value={draft.timeoutMs / 1000} onChange={event => update('timeoutMs', Number(event.target.value) * 1000)} required /></div>
            <div className="field"><label htmlFor="tokens">Max output tokens</label><input id="tokens" name="maxOutputTokens" type="number" min={256} max={64000} step={256} value={draft.maxOutputTokens} onChange={event => update('maxOutputTokens', Number(event.target.value))} required /></div>
          </div>
          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message" role="status">{notice}</p>}
          <div className="form-actions">
            {profiles.some(profile => profile.id === draft.id) && <button className="button danger-button" type="button" disabled={busy} onClick={() => { void remove() }}><Icon name="trash" />{confirmDelete ? 'Confirm delete' : 'Delete'}</button>}
            <button className="button primary" type="submit" disabled={busy}><Icon name="check" />{busy ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
