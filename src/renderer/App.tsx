import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PROMPT, toRunMetadata } from '../shared/types'
import type {
  ModelProfile,
  ProfileInput,
  RunMetadata,
  RunRecord,
} from '../shared/types'
import { AppHeader } from './components/AppHeader'
import { CodeDialog } from './components/CodeDialog'
import { EmptyArt } from './components/EmptyArt'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { Workspace } from './components/Workspace'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { ActiveGeneration } from './types'

type GenerationStartOptions = {
  profile?: ModelProfile
  activeGenerations: Record<string, ActiveGeneration>
  guard: Set<string>
  prompt: string
  deleting: boolean
}

function canStartGeneration({
  profile,
  activeGenerations,
  guard,
  prompt,
  deleting,
}: GenerationStartOptions): boolean {
  if (!profile || !prompt.trim() || deleting) {
    return false
  }
  return !activeGenerations[profile.id] && !guard.has(profile.id)
}

function viewedGeneration(
  pending: ActiveGeneration | undefined,
  current: RunRecord | null,
  activeGenerations: Record<string, ActiveGeneration>,
  activeGeneration?: ActiveGeneration,
): ActiveGeneration | undefined {
  if (pending) {
    return pending
  }
  if (current && activeGenerations[current.profileId]) {
    return activeGenerations[current.profileId]
  }
  return activeGeneration
}

export function App() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [runs, setRuns] = useState<RunMetadata[]>([])
  const [current, setCurrent] = useState<RunRecord | null>(null)
  const [baselineResult, setBaselineResult] = useState<{
    key: string
    record: RunRecord | null
  }>({ key: '', record: null })
  const [activeGenerations, setActiveGenerations] = useState<
    Record<string, ActiveGeneration>
  >({})
  const [pendingGenerationId, setPendingGenerationId] = useState<
    string | null
  >(null)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historyLimit, setHistoryLimit] = useState(50)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [codeRun, setCodeRun] = useState<RunRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [compactHistory, setCompactHistory] = useState(
    () => window.matchMedia('(max-width: 900px)').matches,
  )
  const [zoom, setZoom] = useState(100)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const baselineRequest = useRef(0)
  const pendingGenerationRef = useRef<string | null>(null)
  const generationGuard = useRef(new Set<string>())
  const selectionRequest = useRef(0)
  const historyTrigger = useRef<HTMLButtonElement>(null)
  const historyClose = useRef<HTMLButtonElement>(null)
  const historyWasOpen = useRef(false)

  const showGeneration = useCallback((generationId: string | null) => {
    pendingGenerationRef.current = generationId
    setPendingGenerationId(generationId)
  }, [])

  useEffect(() => {
    let mounted = true
    window.inkdrift.getState().then(async state => {
      if (!mounted) {
        return
      }
      setProfiles(state.profiles)
      setActiveProfileId(state.activeProfileId)
      setPrompt(state.prompt)
      setRuns(state.runs)
      const latest = state.runs.find(run => run.status === 'succeeded')
        ?? state.runs[0]
      if (latest) {
        setCurrent(await window.inkdrift.getRun(latest.id))
      }
    }).catch((cause: unknown) => {
      if (mounted) {
        setError(cause instanceof Error ? cause.message : 'Could not load local data')
      }
    }).finally(() => {
      if (mounted) {
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (prompt.trim()) {
        window.inkdrift.setPrompt(prompt.trim()).catch(() => {})
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [prompt])

  useEffect(() => {
    const flushPrompt = () => {
      if (prompt.trim()) {
        void window.inkdrift.setPrompt(prompt.trim()).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', flushPrompt)
    return () => window.removeEventListener('beforeunload', flushPrompt)
  }, [prompt])

  const comparisonProfileId = current?.profileId ?? activeProfileId
  const comparisonPrompt = (current?.prompt ?? prompt).trim()
  const comparisonKey = `${comparisonProfileId ?? ''}\n${comparisonPrompt}`
  const baseline = baselineResult.key === comparisonKey
    ? baselineResult.record
    : null

  useEffect(() => {
    const request = ++baselineRequest.current
    if (!comparisonProfileId || !comparisonPrompt) {
      return
    }
    const timer = window.setTimeout(() => {
      window.inkdrift.getBaseline(comparisonProfileId, comparisonPrompt)
        .then(value => {
          if (request === baselineRequest.current) {
            setBaselineResult({ key: comparisonKey, record: value })
          }
        }).catch(() => {})
    }, 250)
    return () => window.clearTimeout(timer)
  }, [comparisonProfileId, comparisonPrompt, comparisonKey])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = () => {
      setCompactHistory(query.matches)
      if (!query.matches) {
        setHistoryOpen(false)
      }
    }
    query.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    if (compactHistory && historyOpen) {
      historyClose.current?.focus({ preventScroll: true })
    } else if (compactHistory && historyWasOpen.current) {
      historyTrigger.current?.focus({ preventScroll: true })
    }
    historyWasOpen.current = historyOpen
  }, [compactHistory, historyOpen])

  useEffect(() => {
    if (!pendingDelete) {
      return
    }
    const timer = window.setTimeout(() => setPendingDelete(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [pendingDelete])

  const filteredRuns = useMemo(
    () => historyFilter === 'all'
      ? runs
      : runs.filter(run => run.profileId === historyFilter),
    [historyFilter, runs],
  )
  const visibleRuns = useMemo(
    () => filteredRuns.slice(0, historyLimit),
    [filteredRuns, historyLimit],
  )
  const activeProfile = profiles.find(profile => profile.id === activeProfileId)
  const activeGeneration = activeProfileId
    ? activeGenerations[activeProfileId]
    : undefined
  const pendingGeneration = Object.values(activeGenerations)
    .find(run => run.id === pendingGenerationId)
  const cancelableGeneration = viewedGeneration(
    pendingGeneration,
    current,
    activeGenerations,
    activeGeneration,
  )

  const selectProfile = async (profileId: string) => {
    if (deleting) {
      return
    }
    selectionRequest.current += 1
    setPendingDelete(null)
    setActiveProfileId(profileId)
    setCurrent(null)
    showGeneration(activeGenerations[profileId]?.id ?? null)
    setError('')
    await window.inkdrift.setActiveProfile(profileId)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not select profile')
      })
  }

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
  }, [])

  const selectRun = useCallback(async (runId: string) => {
    if (deleting) {
      return
    }
    const request = ++selectionRequest.current
    setError('')
    setPendingDelete(null)
    showGeneration(null)
    closeHistory()
    try {
      const record = await window.inkdrift.getRun(runId)
      if (request === selectionRequest.current) {
        setCurrent(record)
      }
    } catch (cause) {
      if (request === selectionRequest.current) {
        setError(cause instanceof Error ? cause.message : 'Could not open run')
      }
    }
  }, [closeHistory, deleting, showGeneration])

  const generate = useCallback(async () => {
    if (!canStartGeneration({
      profile: activeProfile,
      activeGenerations,
      guard: generationGuard.current,
      prompt,
      deleting,
    })) {
      return
    }
    selectionRequest.current += 1
    const cleanPrompt = prompt.trim()
    generationGuard.current.add(activeProfile!.id)
    const generation: ActiveGeneration = {
      id: crypto.randomUUID(),
      profileId: activeProfile!.id,
      profileName: activeProfile!.name,
      modelId: activeProfile!.modelId,
      prompt: cleanPrompt,
      startedAt: Date.now(),
      timeoutMs: activeProfile!.timeoutMs,
    }
    setActiveGenerations(previous => ({
      ...previous,
      [generation.profileId]: generation,
    }))
    if (current === null || current.profileId === activeProfile!.id) {
      showGeneration(generation.id)
      setCurrent(null)
    } else {
      showGeneration(null)
    }
    setPrompt(cleanPrompt)
    setError('')
    setNotice('')
    setPendingDelete(null)
    setHistoryFilter('all')
    setHistoryLimit(50)
    try {
      const record = await window.inkdrift.generate(
        generation.profileId,
        generation.prompt,
      )
      setRuns(previous => [
        toRunMetadata(record),
        ...previous.filter(run => run.id !== record.id),
      ])
      if (pendingGenerationRef.current === generation.id) {
        setCurrent(record)
        showGeneration(null)
      }
      if (record.status === 'succeeded') {
        setNotice(
          `${generation.profileName}: new frame added to history. Your baseline is unchanged.`,
        )
      }
    } catch (cause) {
      if (pendingGenerationRef.current === generation.id) {
        showGeneration(null)
      }
      setError(
        `${generation.profileName}: ${cause instanceof Error ? cause.message : 'Generation failed'}`,
      )
    } finally {
      generationGuard.current.delete(generation.profileId)
      setActiveGenerations(previous => Object.fromEntries(
        Object.entries(previous).filter(
          ([profileId]) => profileId !== generation.profileId,
        ),
      ))
    }
  }, [
    activeGenerations,
    activeProfile,
    current,
    deleting,
    prompt,
    showGeneration,
  ])

  const saveProfile = async (input: ProfileInput) => {
    selectionRequest.current += 1
    const saved = await window.inkdrift.saveProfile(input)
    setProfiles(saved)
    setActiveProfileId(input.id)
    setCurrent(null)
    showGeneration(activeGenerations[input.id]?.id ?? null)
    await window.inkdrift.setActiveProfile(input.id)
  }

  const deleteProfile = async (profileId: string) => {
    const remaining = await window.inkdrift.deleteProfile(profileId)
    setProfiles(remaining)
    if (activeProfileId === profileId) {
      selectionRequest.current += 1
      setActiveProfileId(null)
      setCurrent(null)
      showGeneration(null)
    }
  }

  const setAsBaseline = useCallback(async () => {
    if (
      !current
      || current.status !== 'succeeded'
      || deleting
      || pendingGeneration
    ) {
      return
    }
    setError('')
    try {
      await window.inkdrift.setBaseline(current.id)
      setBaselineResult({ key: comparisonKey, record: current })
      setNotice('Baseline updated for this model and prompt.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not set baseline',
      )
    }
  }, [comparisonKey, current, deleting, pendingGeneration])

  const deleteRun = async (run: RunMetadata) => {
    if (deleting) {
      return
    }
    if (pendingDelete !== run.id) {
      setPendingDelete(run.id)
      return
    }
    selectionRequest.current += 1
    setDeleting(true)
    setError('')
    try {
      await window.inkdrift.deleteRun(run.id)
      const remaining = runs.filter(candidate => candidate.id !== run.id)
      setRuns(previous => previous.filter(candidate => candidate.id !== run.id))
      let nextCurrent = current
      if (current?.id === run.id) {
        const candidates = historyFilter === 'all'
          ? remaining
          : remaining.filter(candidate => candidate.profileId === historyFilter)
        const next = candidates.find(candidate => candidate.status === 'succeeded')
          ?? candidates[0]
        nextCurrent = next ? await window.inkdrift.getRun(next.id) : null
        setCurrent(nextCurrent)
      }
      const baselineProfileId = nextCurrent?.profileId ?? activeProfileId
      const baselinePrompt = (nextCurrent?.prompt ?? prompt).trim()
      const nextBaseline = baselineProfileId && baselinePrompt
        ? await window.inkdrift.getBaseline(baselineProfileId, baselinePrompt)
        : null
      setBaselineResult({
        key: `${baselineProfileId ?? ''}\n${baselinePrompt}`,
        record: nextBaseline,
      })
      setPendingDelete(null)
      setNotice('Run deleted from local history.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete run')
    } finally {
      setDeleting(false)
    }
  }

  useKeyboardShortcuts({
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
  })

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#workspace"
        inert={compactHistory && historyOpen}
      >
        Skip to comparison
      </a>
      <AppHeader
        activeRunCount={Object.keys(activeGenerations).length}
        cancelableGeneration={cancelableGeneration}
        canGenerate={Boolean(activeProfile && prompt.trim())}
        deleting={deleting}
        historyOpen={historyOpen}
        inert={compactHistory && historyOpen}
        historyTrigger={historyTrigger}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onGenerate={() => { void generate() }}
        onCancel={profileId => {
          void window.inkdrift.cancelGeneration(profileId)
        }}
      />
      <div className="app-body">
        {compactHistory && historyOpen && (
          <div
            className="history-backdrop"
            aria-hidden="true"
            onClick={closeHistory}
          />
        )}
        <Sidebar
          profiles={profiles}
          activeProfileId={activeProfileId}
          activeGenerations={activeGenerations}
          runs={runs}
          visibleRuns={visibleRuns}
          filteredRunsCount={filteredRuns.length}
          current={current}
          historyFilter={historyFilter}
          historyOpen={historyOpen}
          compactHistory={compactHistory}
          pendingDelete={pendingDelete}
          deleting={deleting}
          historyClose={historyClose}
          onSelectProfile={profileId => { void selectProfile(profileId) }}
          onSelectRun={runId => { void selectRun(runId) }}
          onDeleteRun={deleteRun}
          onHistoryFilter={value => {
            setHistoryFilter(value)
            setHistoryLimit(50)
          }}
          onLoadMore={() => setHistoryLimit(limit => limit + 50)}
          onCloseHistory={closeHistory}
        />
        <Workspace
          prompt={prompt}
          deleting={deleting}
          error={error}
          notice={notice}
          zoom={zoom}
          baseline={baseline}
          current={current}
          activeProfile={activeProfile}
          pendingGeneration={pendingGeneration}
          pendingDelete={pendingDelete}
          inert={compactHistory && historyOpen}
          onPromptChange={setPrompt}
          onPersistPrompt={() => {
            if (prompt.trim()) {
              void window.inkdrift.setPrompt(prompt.trim()).catch(() => {})
            }
          }}
          onDismissMessage={() => {
            setError('')
            setNotice('')
          }}
          onZoomChange={setZoom}
          onCode={setCodeRun}
          onDelete={deleteRun}
          onSetBaseline={() => { void setAsBaseline() }}
        />
      </div>
      {loading && (
        <div className="loading-cover">
          <EmptyArt variant="spark" />
          <p>Opening the archive…</p>
        </div>
      )}
      <SettingsDialog
        open={settingsOpen}
        profiles={profiles}
        onClose={() => setSettingsOpen(false)}
        onSave={saveProfile}
        onDelete={deleteProfile}
      />
      <CodeDialog
        key={codeRun?.id ?? 'empty'}
        run={codeRun}
        onClose={() => setCodeRun(null)}
      />
    </div>
  )
}
