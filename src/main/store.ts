import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { z } from 'zod'
import { DEFAULT_PROMPT } from '../shared/types'
import type { AppState, ModelProfile, ProfileInput, RunMetadata, RunRecord, TokenUsage } from '../shared/types'

const usageSchema = z.object({ inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable() })
const storedProfileSchema = z.object({
  id: z.uuid(), name: z.string(), baseUrl: z.string(), modelId: z.string(),
  timeoutMs: z.number().int(), maxOutputTokens: z.number().int(), encryptedKey: z.string(),
})
const settingsSchema = z.object({
  version: z.literal(1),
  activeProfileId: z.uuid().nullable(),
  prompt: z.string(),
  profiles: z.array(storedProfileSchema),
})
const runMetadataSchema = z.object({
  id: z.uuid(), profileId: z.uuid(), profileName: z.string(), modelId: z.string(),
  prompt: z.string(), promptHash: z.string(), createdAt: z.iso.datetime(), durationMs: z.number().nonnegative(),
  status: z.enum(['succeeded', 'failed', 'cancelled']),
  errorCode: z.enum(['invalid-input', 'invalid-svg', 'timeout', 'provider-error', 'worker-error', 'storage-error', 'cancelled']).optional(),
  errorMessage: z.string().optional(), finishReason: z.string().nullable(), usage: usageSchema, hasSvg: z.boolean(),
})
const runIndexSchema = z.object({ version: z.literal(1), runs: z.array(runMetadataSchema) })
const baselinesSchema = z.object({ version: z.literal(1), entries: z.record(z.string(), z.uuid()) })

type StoredProfile = z.infer<typeof storedProfileSchema>
type Settings = z.infer<typeof settingsSchema>

const EMPTY_USAGE: TokenUsage = { inputTokens: null, outputTokens: null }

function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}

function baselineKey(profileId: string, prompt: string): string {
  return `${profileId}:${promptHash(prompt)}`
}

export class Store {
  private pendingWrites: Promise<void> = Promise.resolve()

  constructor(private readonly root: string) {}

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pendingWrites.then(operation, operation)
    this.pendingWrites = result.then(() => undefined, () => undefined)
    return result
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await mkdir(join(this.root, 'history'), { recursive: true, mode: 0o700 })
  }

  private async readJson<T>(relativePath: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
    try {
      const text = await readFile(join(this.root, relativePath), 'utf8')
      return schema.parse(JSON.parse(text))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
      throw new Error(`Local data could not be read: ${relativePath}`, { cause: error })
    }
  }

  private async writeJson(relativePath: string, value: unknown): Promise<void> {
    const destination = join(this.root, relativePath)
    const temporary = `${destination}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await rename(temporary, destination)
  }

  private settings(): Promise<Settings> {
    return this.readJson('settings.json', settingsSchema, {
      version: 1,
      activeProfileId: null,
      prompt: DEFAULT_PROMPT,
      profiles: [],
    })
  }

  private publicProfile(profile: StoredProfile): ModelProfile {
    return {
      id: profile.id,
      name: profile.name,
      baseUrl: profile.baseUrl,
      modelId: profile.modelId,
      timeoutMs: profile.timeoutMs,
      maxOutputTokens: profile.maxOutputTokens,
      hasApiKey: profile.encryptedKey.length > 0,
    }
  }

  async getState(): Promise<AppState> {
    const [settings, index] = await Promise.all([
      this.settings(),
      this.readJson('history/index.json', runIndexSchema, { version: 1, runs: [] }),
    ])
    return {
      profiles: settings.profiles.map(profile => this.publicProfile(profile)),
      activeProfileId: settings.activeProfileId,
      prompt: settings.prompt,
      runs: index.runs,
    }
  }

  async saveProfile(input: ProfileInput): Promise<ModelProfile[]> {
    return this.mutate(async () => {
      const settings = await this.settings()
      const existing = settings.profiles.find(profile => profile.id === input.id)
      let encryptedKey = existing?.encryptedKey ?? ''
      if (input.apiKey?.trim()) {
        if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this system')
        encryptedKey = (await safeStorage.encryptStringAsync(input.apiKey.trim())).toString('base64')
      }
      if (!encryptedKey) throw new Error('An API key is required for a new profile')
      const stored: StoredProfile = {
        id: input.id,
        name: input.name,
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        timeoutMs: input.timeoutMs,
        maxOutputTokens: input.maxOutputTokens,
        encryptedKey,
      }
      const profiles = existing
        ? settings.profiles.map(profile => profile.id === input.id ? stored : profile)
        : [...settings.profiles, stored]
      await this.writeJson('settings.json', { ...settings, profiles })
      return profiles.map(profile => this.publicProfile(profile))
    })
  }

  async deleteProfile(profileId: string): Promise<ModelProfile[]> {
    return this.mutate(async () => {
      const settings = await this.settings()
      const profiles = settings.profiles.filter(profile => profile.id !== profileId)
      const baselines = await this.readJson('baselines.json', baselinesSchema, { version: 1, entries: {} })
      const entries = Object.fromEntries(Object.entries(baselines.entries).filter(([key]) => !key.startsWith(`${profileId}:`)))
      await this.writeJson('settings.json', {
        ...settings,
        profiles,
        activeProfileId: settings.activeProfileId === profileId ? null : settings.activeProfileId,
      })
      await this.writeJson('baselines.json', { version: 1, entries })
      return profiles.map(profile => this.publicProfile(profile))
    })
  }

  async setActiveProfile(profileId: string): Promise<void> {
    return this.mutate(async () => {
      const settings = await this.settings()
      if (!settings.profiles.some(profile => profile.id === profileId)) throw new Error('Model profile not found')
      await this.writeJson('settings.json', { ...settings, activeProfileId: profileId })
    })
  }

  async setPrompt(prompt: string): Promise<void> {
    return this.mutate(async () => {
      const settings = await this.settings()
      await this.writeJson('settings.json', { ...settings, prompt })
    })
  }

  async credentials(profileId: string): Promise<{ profile: ModelProfile; apiKey: string }> {
    const settings = await this.settings()
    const profile = settings.profiles.find(candidate => candidate.id === profileId)
    if (!profile) throw new Error('Model profile not found')
    if (!profile.encryptedKey) throw new Error('This profile has no API key')
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Secure credential storage is unavailable')
    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(profile.encryptedKey, 'base64'))
    return { profile: this.publicProfile(profile), apiKey: decrypted.result }
  }

  async saveRun(record: RunRecord): Promise<void> {
    return this.mutate(async () => {
      await writeFile(join(this.root, 'history', `${record.id}.txt`), record.rawResponse, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      if (record.svg !== null) {
        await writeFile(join(this.root, 'history', `${record.id}.svg`), record.svg, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      }
      const metadata: Partial<RunRecord> = { ...record }
      delete metadata.rawResponse
      delete metadata.svg
      await this.writeJson(`history/${record.id}.json`, metadata)
      const index = await this.readJson('history/index.json', runIndexSchema, { version: 1, runs: [] })
      const runs = [metadata, ...index.runs.filter(run => run.id !== record.id)]
      await this.writeJson('history/index.json', { version: 1, runs })
    })
  }

  async getRun(runId: string): Promise<RunRecord> {
    const metadata = await this.readJson(`history/${runId}.json`, runMetadataSchema.nullable(), null)
    if (metadata === null) throw new Error('Run not found')
    const [rawResponse, svg] = await Promise.all([
      readFile(join(this.root, 'history', `${runId}.txt`), 'utf8'),
      metadata.hasSvg ? readFile(join(this.root, 'history', `${runId}.svg`), 'utf8') : Promise.resolve(null),
    ])
    return { ...metadata, rawResponse, svg }
  }

  async getBaseline(profileId: string, prompt: string): Promise<RunRecord | null> {
    const baselines = await this.readJson('baselines.json', baselinesSchema, { version: 1, entries: {} })
    const runId = baselines.entries[baselineKey(profileId, prompt)]
    if (!runId) return null
    try {
      const run = await this.getRun(runId)
      return run.profileId === profileId && run.promptHash === promptHash(prompt) && run.status === 'succeeded' ? run : null
    } catch (error) {
      if (error instanceof Error && error.message === 'Run not found') return null
      throw error
    }
  }

  async setBaseline(runId: string): Promise<void> {
    return this.mutate(async () => {
      const run = await this.getRun(runId)
      if (run.status !== 'succeeded' || run.svg === null) throw new Error('Only a successful SVG run can be a baseline')
      const baselines = await this.readJson('baselines.json', baselinesSchema, { version: 1, entries: {} })
      const entries = { ...baselines.entries, [baselineKey(run.profileId, run.prompt)]: runId }
      await this.writeJson('baselines.json', { version: 1, entries })
    })
  }

  metadata(input: Omit<RunMetadata, 'promptHash' | 'usage'> & { usage?: TokenUsage }): RunMetadata {
    return { ...input, promptHash: promptHash(input.prompt), usage: input.usage ?? EMPTY_USAGE }
  }
}
