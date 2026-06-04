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

// ── Linux: flags antes de todo ─────────────────────────────────────────────────
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  // VSync / GPU — evita "GetVSyncParametersIfAvailable() failed"
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
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('meetbox', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('meetbox')
}

// En dev mode no forzamos single instance para que los reinicios con
// hot-reload no dejen un proceso viejo bloqueando la nueva instancia.
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

function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '//auth' || parsed.pathname === '/auth') {
      const token = parsed.searchParams.get('token')
      if (token) mainWindow?.webContents.send('auth-token-received', token)
    }
  } catch { /* URL inválida, ignorar */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
interface ConnectionData {
  token:       string
  user:        { id: string; name: string; email: string; avatar: string | null }
  connectedAt: string
}

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
      // Necesario para que el renderer pueda hacer fetch a localhost
      // sin que Chromium rechace la request por CORS / null-origin.
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
    { label: 'Abrir dashboard web', click: () => shell.openExternal(MEETBOX_API_URL + '/dashboard') },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(buildMenu())
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })

  // El renderer notifica cambios de estado de grabación
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

  // Dashboard
  ipcMain.on('open-dashboard', () => shell.openExternal(MEETBOX_API_URL + '/dashboard'))

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
  // Construir AutoLaunch aquí (dentro de whenReady) para evitar errores de
  // app.getPath('exe') antes de que la app esté lista en Linux
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

  // ── HTTP proxy — Node.js no tiene restricciones CORS ─────────────────────────
  // El renderer llama a este handler para hacer requests al backend web
  // sin que Chromium las bloquee por CORS / null-origin.
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
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.meetbox.desktop')

  // 1. Registrar todos los IPC handlers PRIMERO
  registerIpcHandlers()

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

app.on('window-all-closed', () => { /* mantenemos viva la app via tray */ })

declare global {
  namespace Electron { interface App { isQuitting: boolean } }
}
app.isQuitting = false
