import { useEffect, useRef, useState } from 'react'
import type { RunRecord } from '../../shared/types'
import { Icon } from './Icon'

export function CodeDialog({ run, onClose }: { run: RunRecord | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (run && !dialog.open) dialog.showModal()
    if (!run && dialog.open) dialog.close()
  }, [run])
  const copy = async () => {
    if (!run?.rawResponse) return
    try {
      await window.inkdrift.copyRun(run.id)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy failed')
    }
  }

  return (
    <dialog ref={ref} className="code-dialog" aria-labelledby="code-title" onClose={onClose}>
      {run && <>
        <header className="dialog-header">
          <div><p className="eyebrow">RAW RESPONSE</p><h2 id="code-title">{run.profileName}</h2></div>
          <div className="panel-actions">
            <button className="button secondary" type="button" onClick={() => { void copy() }}><Icon name="copy" /> Copy code</button>
            <button className="icon-button" type="button" aria-label="Close raw response" onClick={() => ref.current?.close()}><Icon name="close" /></button>
          </div>
        </header>
        <div className="code-meta"><span>{run.modelId}</span><span>{new Date(run.createdAt).toLocaleString()}</span></div>
        <pre className="raw-code" role="region" aria-label="Raw model response" tabIndex={0}><code>{run.rawResponse || '(empty response)'}</code></pre>
        <span className="copy-status" role="status">{copyStatus}</span>
      </>}
    </dialog>
  )
}
