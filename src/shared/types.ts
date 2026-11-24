export const DEFAULT_PROMPT = 'Generate an SVG of Charmander riding a bicycle. Return only the SVG code, without Markdown fences or explanation.'
export const SYSTEM_PROMPT = 'You are an SVG generator. Return only one self-contained SVG document. Do not include Markdown, explanations, or any other text.'

export type ProviderType = 'openai' | 'anthropic'

export type ModelProfile = {
  id: string
  name: string
  providerType: ProviderType
  baseUrl: string
  modelId: string
  timeoutMs: number
  maxOutputTokens: number
  temperature?: number
  topP?: number
  topK?: number
  hasApiKey: boolean
}

export type ProfileInput = Omit<ModelProfile, 'hasApiKey'> & {
  apiKey?: string
  forkFromId?: string
}

export type TokenUsage = {
  inputTokens: number | null
  outputTokens: number | null
}

export type RunStatus = 'succeeded' | 'failed' | 'cancelled'
export type RunErrorCode = 'invalid-input' | 'invalid-svg' | 'timeout' | 'provider-error' | 'worker-error' | 'storage-error' | 'cancelled'

export type RunMetadata = {
  id: string
  profileId: string
  profileName: string
  modelId: string
  prompt: string
  promptHash: string
  createdAt: string
  durationMs: number
  status: RunStatus
  errorCode?: RunErrorCode
  errorMessage?: string
  finishReason: string | null
  usage: TokenUsage
  hasSvg: boolean
}

export type RunRecord = RunMetadata & {
  rawResponse: string
  svg: string | null
}

export type AppState = {
  profiles: ModelProfile[]
  activeProfileId: string | null
  prompt: string
  runs: RunMetadata[]
}

export function toRunMetadata(record: RunRecord): RunMetadata {
  const value: Partial<RunRecord> = { ...record }
  delete value.rawResponse
  delete value.svg
  return value as RunMetadata
}

export type PublicError = {
  code: string
  message: string
}
