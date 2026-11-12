import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { generationInputSchema, profileInputSchema, promptSchema, runIdSchema } from '../shared/validation'
import { Runner } from './runner'
import { Store } from './store'

const APP_ORIGIN = 'inkdrift://app'
const DEV_ORIGIN = 'http://127.0.0.1:5173'
const runner = new Runner()
let store: Store
let mainWindow: BrowserWindow | null = null

protocol.registerSchemesAsPrivileged([{ scheme: 'inkdrift', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

function validateSender(event: IpcMainInvokeEvent): void {
  const origin = event.senderFrame?.origin
  if (origin !== APP_ORIGIN && !(process.env.NODE_ENV !== 'production' && origin === DEV_ORIGIN)) throw new Error('Untrusted IPC sender')
}

function handle(channel: string, callback: (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>): void {
  ipcMain.handle(channel, async (event, input) => {
    validateSender(event)
    try {
      return await callback(event, input)
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues[0]?.message ?? 'Invalid input' : error instanceof Error ? error.message : 'Unexpected application error'
      throw new Error(message, { cause: error })
    }
  })
}

function registerIpc(): void {
  handle('state:get', () => store.getState())
  handle('profile:save', async (_event, input) => store.saveProfile(profileInputSchema.parse(input)))
  handle('profile:delete', async (_event, input) => {
    if (runner.isRunning) throw new Error('Cancel the current generation before deleting a profile')
    return store.deleteProfile(runIdSchema.parse(input))
  })
  handle('profile:activate', (_event, input) => store.setActiveProfile(runIdSchema.parse(input)))
  handle('prompt:set', (_event, input) => store.setPrompt(promptSchema.parse(input)))
  handle('generation:run', async (_event, input) => {
    const request = generationInputSchema.parse(input)
    const record = await runner.generate(store, request.profileId, request.prompt)
    await store.saveRun(record)
    return record
  })
  handle('generation:cancel', () => {
    runner.cancel()
    return Promise.resolve()
  })
  handle('run:get', (_event, input) => store.getRun(runIdSchema.parse(input)))
  handle('baseline:get', (_event, input) => {
    const request = generationInputSchema.parse(input)
    return store.getBaseline(request.profileId, request.prompt)
  })
  handle('baseline:set', (_event, input) => store.setBaseline(runIdSchema.parse(input)))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#f3f3f3',
    title: 'Inkdrift',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', event => {
    const allowed = app.isPackaged ? APP_ORIGIN : DEV_ORIGIN
    if (new URL(event.url).origin !== allowed) event.preventDefault()
  })
  if (app.isPackaged) void mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
  else void mainWindow.loadURL(DEV_ORIGIN)
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'))
  await store.initialize()
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  if (app.isPackaged) {
    const root = resolve(app.getAppPath(), 'dist-renderer')
    protocol.handle('inkdrift', request => {
      const url = new URL(request.url)
      if (url.host !== 'app') return new Response('Not found', { status: 404 })
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
      const filename = resolve(root, `.${pathname}`)
      const rel = relative(root, filename)
      if (rel.startsWith('..') || resolve(filename) === root) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(filename).toString())
    })
  }
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}).catch((error: unknown) => {
  console.error('Application initialization failed', error instanceof Error ? error.message : 'unknown error')
  app.quit()
})

app.on('before-quit', () => { runner.cancel() })
app.on('window-all-closed', () => { app.quit() })
