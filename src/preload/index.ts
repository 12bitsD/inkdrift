import { contextBridge, ipcRenderer } from 'electron'
import type { InkdriftApi } from '../shared/api'
import type { ProfileInput } from '../shared/types'

const api: InkdriftApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  saveProfile: (input: ProfileInput) => ipcRenderer.invoke('profile:save', input),
  deleteProfile: profileId => ipcRenderer.invoke('profile:delete', profileId),
  setActiveProfile: profileId => ipcRenderer.invoke('profile:activate', profileId),
  setPrompt: prompt => ipcRenderer.invoke('prompt:set', prompt),
  generate: (profileId, prompt) => ipcRenderer.invoke('generation:run', { profileId, prompt }),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  getRun: runId => ipcRenderer.invoke('run:get', runId),
  getRunSvg: runId => ipcRenderer.invoke('run:svg', runId),
  copyRun: runId => ipcRenderer.invoke('run:copy', runId),
  deleteRun: runId => ipcRenderer.invoke('run:delete', runId),
  getBaseline: (profileId, prompt) => ipcRenderer.invoke('baseline:get', { profileId, prompt }),
  setBaseline: runId => ipcRenderer.invoke('baseline:set', runId),
}

contextBridge.exposeInMainWorld('inkdrift', api)
