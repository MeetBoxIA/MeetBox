/**
 * MeetBox Desktop — Electron main process.
 *
 * Responsibilities:
 *   - Create the frameless BrowserWindow and system tray
 *   - Register the `meetbox://` deep-link protocol handler
 *   - Expose IPC handlers for the renderer (window controls, connection
 *     persistence, audio capture, recording save, HTTP proxy)
 *   - Manage the auto-updater lifecycle (check, notify, install)
 *   - Request microphone/audio permissions from Chromium's permission system
 *
 * The HTTP proxy IPC handler (`http-post`) lets the renderer make requests
 * to the MeetBox backend through Node.js, bypassing Chromium's CORS
 * restrictions that block requests from file:// and null origins.
 */
import {
  app,
  shell,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  protocol,
  Notification,
  desktopCapturer,
  dialog,
  session,
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import AutoLaunch from 'auto-launch'
import fs from 'fs'
import os from 'os'

// ── Linux: flags must be set before app.on('ready') ───────────────────────────
// These suppress GPU/VSync errors that appear on many Linux desktop environments
// and are harmless on hardware where the GPU path works correctly.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  // Suppress "GetVSyncParametersIfAvailable() failed" log spam
  app.commandLine.appendSwitch('disable-gpu-vsync')
  app.commandLine.appendSwitch('disable-frame-rate-limit')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  app.commandLine.appendSwitch('disable-software-rasterizer')
  app.commandLine.appendSwitch('enable-usermedia-screen-capturing')
}

// ── Estado global ──────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isRecording = false

const MEETBOX_API_URL = process.env.MEETBOX_API_URL ?? 'https://meetbox.io'

// ── Single instance lock ───────────────────────────────────────────────────────
// Register the meetbox:// URI scheme so the OS can deep-link into the app.
// process.defaultApp is true when Electron itself is the executable (dev mode
// via `electron .`), requiring the path to be passed as a protocol client arg.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('meetbox', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('meetbox')
}

// Skip single-instance lock in dev so hot-reload restarts don't leave a
// stale process holding the lock and blocking the new instance.
const isDev = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL
if (!isDev) {
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, commandLine) => {
      mainWindow?.isMinimized() && mainWindow.restore()
      mainWindow?.show()
      mainWindow?.focus()
      const url = commandLine.find((a) => a.startsWith('meetbox://'))
      if (url) handleDeepLink(url)
    })
  }
}

app.on('open-url', (_event, url) => handleDeepLink(url))

/**
 * Handle a meetbox:// deep link URL.
 * Currently only the /auth path is used — the web dashboard redirects here
 * after OAuth with ?token=... so the renderer can finalize the connection.
 */
function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '//auth' || parsed.pathname === '/auth') {
      const token = parsed.searchParams.get('token')
      if (token) mainWindow?.webContents.send('auth-token-received', token)
    }
  } catch { /* invalid URL — ignore silently */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
interface ConnectionData {
  token:        string
  accessToken?: string                 // bearer token for /api/desktop/* requests
  apiUrl?:      string                 // base URL that was used to connect
  user:         { id: string; name: string; email: string; avatar: string | null }
  connectedAt:  string
}

/** Read the persisted connection (or null if not connected). */
function readConnection(): ConnectionData | null {
  try {
    const file = connectionFile()
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ConnectionData
  } catch {
    return null
  }
}

/** Read the persisted bearer token (or null if not connected). */
function readAccessToken(): string | null {
  return readConnection()?.accessToken ?? null
}

/**
 * Resolve the backend base URL. Prefers the URL stored at connect time so the
 * desktop always talks to the same backend it linked to (e.g. localhost:3000 in
 * dev), falling back to the env var and finally production.
 */
function readApiUrl(): string {
  return readConnection()?.apiUrl ?? MEETBOX_API_URL
}

/**
 * Path to the JSON file that persists the user's desktop connection.
 * Stored in Electron's userData directory (OS-specific app data folder)
 * so it survives app restarts and updates.
 */
function connectionFile(): string {
  return join(app.getPath('userData'), 'connection.json')
}

// ── createWindow ───────────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420, height: 640,
    minWidth: 380, minHeight: 580,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    show: false,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // webSecurity: false lets the renderer fetch localhost without Chromium
      // rejecting requests due to CORS / null-origin from file:// pages.
      webSecurity: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow!.hide()
      if (Notification.isSupported()) {
        new Notification({
          title: 'MeetBox Desktop sigue activo',
          body: 'La app corre en la bandeja del sistema.',
          icon: join(__dirname, '../../build/icon.png'),
        }).show()
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // DevTools solo si se pide explícitamente — evita errores de Autofill.enable
    if (process.env['OPEN_DEVTOOLS'] === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── createTray ─────────────────────────────────────────────────────────────────
function createTray(): void {
  const iconPath = join(__dirname, '../../build/tray-icon.png')
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
        'AXNSRXIAvL3CNQAAAA9JREFUOMtjYBgFgx0AAAIQAAFdkrwAAAAASUVORK5CYII='
      )

  tray = new Tray(trayIcon)
  tray.setToolTip('MeetBox Desktop')

  const buildMenu = () => Menu.buildFromTemplate([
    { label: 'Abrir MeetBox', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    {
      label: isRecording ? '⏹ Detener grabación' : '⏺ Iniciar grabación',
      click: () => { mainWindow?.show(); mainWindow?.webContents.send('tray-toggle-recording') },
    },
    { type: 'separator' },
    { label: 'Abrir dashboard web', click: () => shell.openExternal(readApiUrl() + '/dashboard') },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(buildMenu())
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })

  // Keep tray menu and tooltip in sync with the renderer's recording state
  ipcMain.on('recording-state-changed', (_e, recording: boolean) => {
    isRecording = recording
    tray?.setContextMenu(buildMenu())
    tray?.setToolTip(recording ? 'MeetBox Desktop — Grabando…' : 'MeetBox Desktop')
  })
}

// ── setupAutoUpdater ───────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  if (is.dev) return
  autoUpdater.checkForUpdatesAndNotify()
  autoUpdater.on('update-available',  () => mainWindow?.webContents.send('update-available'))
  autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded'))
}

// ── registerIpcHandlers ── TODOS los handlers aquí, llamado en app.whenReady() ──
function registerIpcHandlers(): void {
  // Ventana
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-close',    () => mainWindow?.hide())

  // Info
  ipcMain.handle('get-app-version', () => app.getVersion())

  // Dashboard — opens the web app; if a sessionId is provided, deep-links to
  // that specific MeetAction session so the user lands exactly on their results.
  ipcMain.on('open-dashboard', (_e, sessionId?: string) => {
    const base = readApiUrl() + '/dashboard'
    const url  = sessionId
      ? `${base}?section=meetaction&session=${encodeURIComponent(sessionId)}`
      : `${base}?section=meetaction`
    shell.openExternal(url)
  })

  // "Revisar acciones en el dashboard" — the dashboard already lives in the
  // user's browser (Electron can't reuse its tabs), so opening a new window
  // here can land on a different browser/profile and force a re-login.
  // Minimizing instead reveals whatever dashboard window the user already
  // has open behind the recorder, with zero new windows and no login prompt.
  ipcMain.on('focus-dashboard', () => {
    mainWindow?.minimize()
  })

  // Import an existing audio/video recording.
  // If filePath is provided, uploads that file directly (e.g. after saving a new
  // recording). Otherwise opens a file picker to let the user choose any file.
  ipcMain.handle('import-recording', async (_e, providedPath?: string) => {
    let filePath: string

    if (providedPath) {
      filePath = providedPath
    } else {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
        title:      'Selecciona una grabación para importar',
        buttonLabel: 'Importar',
        filters: [
          { name: 'Audio / Video', extensions: ['mp3', 'wav', 'm4a', 'webm', 'mp4', 'ogg', 'flac'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })
      if (canceled || filePaths.length === 0) return { ok: false, error: 'Cancelado' }
      filePath = filePaths[0]
    }

    const token = readAccessToken()
    if (!token) return { ok: false, error: 'No hay sesión de desktop. Reconecta tu cuenta.' }

    const filename = filePath.split(/[\\/]/).pop() ?? 'grabacion-importada'
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    const MIME_BY_EXT: Record<string, string> = {
      webm: 'audio/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg',
      wav:  'audio/wav',  m4a: 'audio/mp4', mp4: 'video/mp4', flac: 'audio/flac',
    }
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'

    try {
      const buffer = fs.readFileSync(filePath)

      const form = new FormData()
      form.append('file', new Blob([buffer], { type: mime }), filename)
      form.append('metadata', JSON.stringify({
        meetingTitle: filename.replace(/\.[^.]+$/, ''),
        source:       'import',
      }))

      const res  = await fetch(readApiUrl() + '/api/desktop/upload', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      })
      const data = await res.json().catch(() => ({})) as { job_id?: string; error?: string }
      if (!res.ok) return { ok: false, error: data.error ?? `Error ${res.status}` }
      return { ok: true, jobId: data.job_id }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error al importar' }
    }
  })

  // ── Conexión con cuenta web ──────────────────────────────────────────────────
  ipcMain.handle('get-connection', (): ConnectionData | null => {
    try {
      const file = connectionFile()
      if (!fs.existsSync(file)) return null
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as ConnectionData
    } catch {
      return null
    }
  })

  ipcMain.handle('save-connection', (_e, data: ConnectionData): void => {
    try {
      const file = connectionFile()
      const dir  = join(file, '..')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('save-connection error:', err)
    }
  })

  ipcMain.handle('clear-connection', (): void => {
    try {
      const file = connectionFile()
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch { /* ignorar */ }
  })

  // ── Auto-launch ──────────────────────────────────────────────────────────────
  // Instantiate AutoLaunch inside whenReady() — calling app.getPath('exe') before
  // the app is ready throws on Linux, so we can't do this at module top-level.
  let autoLaunch: AutoLaunch | null = null
  try {
    autoLaunch = new AutoLaunch({ name: 'MeetBox Desktop', path: app.getPath('exe') })
  } catch (err) {
    console.warn('AutoLaunch init failed (normal en dev):', err)
  }

  ipcMain.handle('get-auto-launch', async () => {
    try { return await autoLaunch?.isEnabled() ?? false } catch { return false }
  })
  ipcMain.handle('set-auto-launch', async (_e, enabled: boolean) => {
    try {
      if (enabled) await autoLaunch?.enable()
      else await autoLaunch?.disable()
    } catch (err) {
      console.warn('set-auto-launch error:', err)
    }
    return enabled
  })

  // ── Audio del sistema ────────────────────────────────────────────────────────
  ipcMain.handle('get-desktop-audio-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: false })
      return sources.map((s) => ({ id: s.id, name: s.name }))
    } catch { return [] }
  })

  // ── Grabaciones ──────────────────────────────────────────────────────────────
  ipcMain.handle('save-recording', async (_e, buffer: ArrayBuffer, filename: string) => {
    const docsDir = join(os.homedir(), 'Documents', 'MeetBox')
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true })
    const filePath = join(docsDir, filename)
    fs.writeFileSync(filePath, Buffer.from(buffer))
    if (Notification.isSupported()) {
      new Notification({
        title: 'Grabación guardada',
        body:  'Guardado en Documentos/MeetBox. Impórtalo en el dashboard.',
        icon:  join(__dirname, '../../build/icon.png'),
      }).show()
    }
    return filePath
  })

  ipcMain.on('show-recording-in-folder', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('show-save-dialog', async (_e, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: join(os.homedir(), 'Documents', 'MeetBox', defaultName),
      filters: [{ name: 'Audio WebM', extensions: ['webm'] }],
    })
    return result.canceled ? null : result.filePath
  })

  // ── Auto-updater install ─────────────────────────────────────────────────────
  ipcMain.on('install-update', () => autoUpdater.quitAndInstall())

  // ── HTTP proxy via Node.js (no CORS restrictions) ─────────────────────────
  // Chromium blocks requests from file:// to external origins; Node.js fetch
  // in the main process has no such restriction. The renderer calls this
  // handler to proxy API requests through the main process instead.
  ipcMain.handle('http-post', async (_e, url: string, body: unknown) => {
    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, data }
    } catch (err) {
      return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : 'Error de red' } }
    }
  })

  // ── Upload recording to the backend pipeline ──────────────────────────────
  // Sends the audio as multipart/form-data to /api/desktop/upload with the
  // stored bearer token. Runs in the main process so Node.js handles the
  // multipart body and there are no CORS restrictions.
  ipcMain.handle('upload-recording', async (_e, buffer: ArrayBuffer, filename: string, metadata: Record<string, unknown>) => {
    const token = readAccessToken()
    if (!token) return { ok: false, error: 'No hay sesión de desktop. Reconecta tu cuenta.' }

    try {
      const form = new FormData()
      form.append('file', new Blob([buffer], { type: 'audio/webm' }), filename)
      form.append('metadata', JSON.stringify(metadata ?? {}))

      const res  = await fetch(readApiUrl() + '/api/desktop/upload', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      })
      const data = await res.json().catch(() => ({})) as { job_id?: string; error?: string }
      if (!res.ok) return { ok: false, error: data.error ?? `Error ${res.status}` }
      return { ok: true, jobId: data.job_id }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
    }
  })

  // ── Poll job status ────────────────────────────────────────────────────────
  ipcMain.handle('get-job-status', async (_e, jobId: string) => {
    const token = readAccessToken()
    if (!token) return { ok: false, error: 'No autenticado' }
    try {
      const res  = await fetch(`${readApiUrl()}/api/desktop/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, ...data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
    }
  })
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.meetbox.desktop')

  // 1. Registrar todos los IPC handlers PRIMERO
  registerIpcHandlers()

  // 1.5. Forzar vinculación en cada arranque: se borra cualquier conexión
  // persistida para que el grabador SIEMPRE inicie en ConnectScreen y el usuario
  // pegue un código MBOX nuevo. Así las grabaciones quedan vinculadas a la cuenta
  // que el usuario quiere ahora, no a la de una sesión anterior. (connection.json
  // se vuelve a guardar al conectar y se usa durante la sesión para las subidas;
  // se elimina otra vez en el siguiente arranque.)
  try {
    const f = connectionFile()
    if (fs.existsSync(f)) fs.unlinkSync(f)
  } catch (err) {
    console.warn('No se pudo limpiar la conexión persistida al arrancar:', err)
  }

  // 2. Permisos de audio/micrófono
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'audioCapture', 'microphone', 'mediaKeySystem'].includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'audioCapture', 'microphone', 'mediaKeySystem'].includes(permission)
  })

  // 3. Protocolo local-resource
  protocol.registerFileProtocol('local-resource', (req, cb) => {
    cb({ path: decodeURIComponent(req.url.replace('local-resource://', '')) })
  })

  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))

  // 4. Crear ventana y tray
  createWindow()
  createTray()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else { mainWindow?.show(); mainWindow?.focus() }
  })
})

// Keep the app alive via the tray even when all windows are closed
app.on('window-all-closed', () => { /* intentionally no-op — tray keeps app running */ })

declare global {
  namespace Electron { interface App { isQuitting: boolean } }
}
app.isQuitting = false
