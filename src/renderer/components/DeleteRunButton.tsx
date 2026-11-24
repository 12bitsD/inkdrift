import type { RunMetadata } from '../../shared/types'
import { Icon } from './Icon'

type DeleteRunButtonProps = {
  run: RunMetadata
  pending: boolean
  deleting: boolean
  onDelete: (run: RunMetadata) => Promise<void>
  target: string
  history?: boolean
}

export function DeleteRunButton({
  run,
  pending,
  deleting,
  onDelete,
  target,
  history = false,
}: DeleteRunButtonProps) {
  const action = pending ? 'Confirm delete' : 'Delete'
  const classes = [
    'icon-button',
    history ? 'history-delete' : '',
    pending ? 'labelled delete-confirm' : '',
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes}
      aria-label={`${action} ${target}`}
      disabled={deleting}
      onClick={() => { void onDelete(run) }}
    >
      <Icon name="trash" size={history ? 15 : 18} />
      {pending && <span>{deleting ? 'Deleting…' : 'Confirm'}</span>}
    </button>
  )
}
