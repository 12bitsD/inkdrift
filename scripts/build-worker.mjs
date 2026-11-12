import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const python = process.env.INKDRIFT_PYTHON ?? resolve(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
if (!existsSync(python)) throw new Error(`Python 3.11 not found at ${python}. Set INKDRIFT_PYTHON or create .venv.`)

const result = spawnSync(python, [
  '-m', 'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onedir',
  '--name', 'inkdrift-worker',
  '--distpath', resolve(root, 'worker/dist'),
  '--workpath', resolve(root, 'worker/build'),
  '--specpath', resolve(root, 'worker/build'),
  '--paths', resolve(root, 'worker/src'),
  '--collect-all', 'nextloop',
  ...(process.env.INKDRIFT_WORKER_ARCH ? ['--target-architecture', process.env.INKDRIFT_WORKER_ARCH] : []),
  resolve(root, 'worker/src/inkdrift_worker_cli.py'),
], { cwd: root, stdio: 'inherit' })

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
