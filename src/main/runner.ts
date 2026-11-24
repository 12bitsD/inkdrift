import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import { SYSTEM_PROMPT } from '../shared/types'
import type {
  ModelProfile,
  RunErrorCode,
  RunRecord,
  TokenUsage,
} from '../shared/types'
import { workerResponseSchema } from '../shared/worker'
import type { Store } from './store'

const EMPTY_USAGE: TokenUsage = { inputTokens: null, outputTokens: null }
type ActiveRun = {
  child: ChildProcessWithoutNullStreams | null
  cancelled: boolean
}
type RunOutcome = Pick<
  RunRecord,
  'status' | 'errorCode' | 'errorMessage' | 'rawResponse' | 'svg'
  | 'finishReason' | 'usage' | 'hasSvg'
>
type CloseResult = { code: number | null; spawnError: boolean }
type WorkerCommand = {
  command: string
  args: string[]
  pythonPath?: string
}

function workerCommand(): WorkerCommand {
  if (app.isPackaged) {
    const executable = process.platform === 'win32'
      ? 'inkdrift-worker.exe'
      : 'inkdrift-worker'
    return {
      command: join(
        process.resourcesPath,
        'worker',
        'inkdrift-worker',
        executable,
      ),
      args: [],
    }
  }
  const root = app.getAppPath()
  const command = process.env.INKDRIFT_PYTHON ?? resolve(
    root,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  )
  return {
    command,
    args: ['-m', 'inkdrift_worker'],
    pythonPath: resolve(root, 'worker/src'),
  }
}

function workerPayload(profile: ModelProfile, runId: string, prompt: string) {
  return {
    version: 1,
    runId,
    system: SYSTEM_PROMPT,
    prompt,
    provider: {
      type: profile.providerType,
      modelId: profile.modelId,
      baseUrl: profile.baseUrl,
    },
    maxOutputTokens: profile.maxOutputTokens,
    timeoutMs: profile.timeoutMs,
    temperature: profile.temperature,
    topP: profile.topP,
    topK: profile.topK,
  }
}

export class Runner {
  private active = new Map<string, ActiveRun>()

  isRunning(profileId?: string): boolean {
    return profileId ? this.active.has(profileId) : this.active.size > 0
  }

  async generate(store: Store, profileId: string, prompt: string): Promise<RunRecord> {
    if (this.active.has(profileId)) {
      throw new Error('A generation is already running for this profile')
    }
    const active: ActiveRun = { child: null, cancelled: false }
    this.active.set(profileId, active)
    const startedAt = Date.now()
    try {
      const { profile, apiKey } = await store.credentials(profileId)
      const runId = randomUUID()
      const base = store.metadata({
        id: runId,
        profileId: profile.id,
        profileName: profile.name,
        modelId: profile.modelId,
        prompt,
        createdAt: new Date(startedAt).toISOString(),
        durationMs: 0,
        status: 'failed',
        finishReason: null,
        hasSvg: false,
      })
      if (active.cancelled) {
        return {
          ...base,
          ...this.failure('cancelled', 'Generation cancelled', 'cancelled'),
          durationMs: Date.now() - startedAt,
        }
      }
      const result = await this.execute(profile, apiKey, runId, prompt, active)
      return { ...base, ...result, durationMs: Date.now() - startedAt }
    } finally {
      if (this.active.get(profileId) === active) {
        this.active.delete(profileId)
      }
    }
  }

  cancel(profileId?: string): void {
    const activeRuns = profileId
      ? [this.active.get(profileId)]
      : [...this.active.values()]
    for (const active of activeRuns) {
      if (!active) {
        continue
      }
      active.cancelled = true
      active.child?.kill('SIGTERM')
    }
  }

  private async execute(
    profile: ModelProfile,
    apiKey: string,
    runId: string,
    prompt: string,
    active: ActiveRun,
  ): Promise<RunOutcome> {
    const { command, args, pythonPath } = workerCommand()
    if (!existsSync(command)) {
      return this.failure(
        'worker-error',
        'The Nextloop worker is missing. Reinstall or rebuild the application.',
      )
    }
    const child = spawn(command, args, {
      env: {
        PATH: process.env.PATH ?? '',
        ...(process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
        ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
        ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
        ...(pythonPath ? { PYTHONPATH: pythonPath } : {}),
        PYTHONUNBUFFERED: '1',
        INKDRIFT_API_KEY: apiKey,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    active.child = child
    const flags = { timedOut: false, oversized: false }
    const timer = setTimeout(() => {
      flags.timedOut = true
      child.kill('SIGTERM')
    }, profile.timeoutMs + 2_000)
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      if (flags.oversized) {
        return
      }
      stdout += chunk
      if (Buffer.byteLength(stdout) > 8 * 1024 * 1024) {
        flags.oversized = true
        child.kill('SIGTERM')
      }
    })
    child.stderr.resume()
    child.stdin.on('error', () => {})
    const close = new Promise<CloseResult>(resolveClose => {
      child.once('error', () => resolveClose({ code: null, spawnError: true }))
      child.once('close', code => resolveClose({ code, spawnError: false }))
    })
    child.stdin.end(JSON.stringify(workerPayload(profile, runId, prompt)))
    const result = await close
    clearTimeout(timer)
    if (active.cancelled) {
      return this.failure('cancelled', 'Generation cancelled', 'cancelled')
    }
    if (flags.timedOut) {
      return this.failure('timeout', 'The generation timed out')
    }
    if (flags.oversized) {
      return this.failure('worker-error', 'The worker response was too large')
    }
    if (result.spawnError) {
      return this.failure(
        'worker-error',
        'The Nextloop worker could not be started',
      )
    }
    return this.readResult(stdout, result)
  }

  private readResult(stdout: string, result: CloseResult): RunOutcome {
    try {
      const response = workerResponseSchema.parse(JSON.parse(stdout))
      if (result.code !== 0 && response.kind === 'succeeded') {
        return this.failure(
          'worker-error',
          'The worker returned an inconsistent result',
        )
      }
      if (response.kind === 'succeeded') {
        return {
          status: 'succeeded',
          rawResponse: response.rawText,
          svg: response.svg,
          finishReason: response.finishReason,
          usage: response.usage,
          hasSvg: true,
        }
      }
      return {
        ...this.failure(response.code, response.message),
        rawResponse: response.rawText ?? '',
        finishReason: response.finishReason ?? null,
        usage: response.usage ?? EMPTY_USAGE,
      }
    } catch {
      return {
        ...this.failure(
          'worker-error',
          'The Nextloop worker returned an unreadable result',
        ),
        rawResponse: stdout,
      }
    }
  }

  private failure(
    code: RunErrorCode,
    message: string,
    status: 'failed' | 'cancelled' = 'failed',
  ): RunOutcome {
    return {
      status,
      errorCode: code,
      errorMessage: message,
      rawResponse: '',
      svg: null,
      finishReason: null,
      usage: EMPTY_USAGE,
      hasSvg: false,
    }
  }
}
