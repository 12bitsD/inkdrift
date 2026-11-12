import type { AppState, ModelProfile, ProfileInput, RunRecord } from './types'

export type InkdriftApi = {
  getState: () => Promise<AppState>
  saveProfile: (input: ProfileInput) => Promise<ModelProfile[]>
  deleteProfile: (profileId: string) => Promise<ModelProfile[]>
  setActiveProfile: (profileId: string) => Promise<void>
  setPrompt: (prompt: string) => Promise<void>
  generate: (profileId: string, prompt: string) => Promise<RunRecord>
  cancelGeneration: () => Promise<void>
  getRun: (runId: string) => Promise<RunRecord>
  copyRun: (runId: string) => Promise<void>
  deleteRun: (runId: string) => Promise<void>
  getBaseline: (profileId: string, prompt: string) => Promise<RunRecord | null>
  setBaseline: (runId: string) => Promise<void>
}
