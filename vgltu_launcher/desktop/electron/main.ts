import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'path'
import axios from 'axios'
import os from 'os'
import { GameManager } from './game-manager'
import { getApiUrl } from './config'

// ОПТИМИЗАЦИЯ RAM
app.disableHardwareAcceleration();

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// URL загружается лениво после app.whenReady()
let API_BASE = ''
let API_URL = ''
let AUTH_URL = ''

let authData: { username: string; uuid: string; accessToken: string } | null = null
let mainWindow: BrowserWindow | null = null

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || error.message
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    show: false
  })

  // CSP
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' http://localhost:* https://*; " +
          "font-src 'self' data:;"
        ]
      }
    })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => {
    win.show()
  })

  return win
}

app.whenReady().then(() => {
  // Инициализируем URL из конфига после готовности app
  API_BASE = getApiUrl()
  API_URL = `${API_BASE}/api`
  AUTH_URL = API_BASE
  console.log(`🌐 API URL: ${API_BASE}`)

  mainWindow = createWindow()
  const gameManager = new GameManager(mainWindow)

  ipcMain.handle('get-system-info', () => {
    return {
      totalRam: Math.floor(os.totalmem() / 1024 / 1024)
    }
  })

  ipcMain.handle('open-external', async (_event, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
          await shell.openExternal(url)
      }
  })

  ipcMain.handle('get-instances', async () => {
     try {
       const res = await axios.get(`${API_URL}/client/instances`)
       const instances = res.data.items || []
       gameManager.cleanOldInstances(instances).catch(console.error)
       return instances
     } catch (e) {
       console.error("Failed to fetch instances", e)
       return [] 
     }
  })

  ipcMain.handle('login', async (_event, username: string, password: string) => {
    try {
      const normalizedUsername = username.trim()
      if (!normalizedUsername || !password) {
        return { success: false, error: 'Username and password are required' }
      }

      gameManager.log(`🔐 Attempting login for ${normalizedUsername}...`)
      const res = await axios.post(`${AUTH_URL}/authserver/authenticate`, {
        username: normalizedUsername,
        password,
        agent: { name: "Minecraft", version: 1 }
      })
      
      const data = res.data
      authData = {
        username: data.selectedProfile.name,
        uuid: data.selectedProfile.id,
        accessToken: data.accessToken
      }
      
      gameManager.log(`✅ Logged in as ${authData.username}`)
      return { success: true, username: authData.username }
    } catch (error: unknown) {
      const message = errorMessage(error)
      gameManager.log(`❌ Login failed: ${message}`)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('launch-game', async (_event, instanceId, ram) => {
    try {
      if (!authData) {
        gameManager.log(`❌ Not logged in!`)
        return
      }
      
      const memory = ram || 2048

      gameManager.log(`⏳ Fetching manifest for ${instanceId}...`)
      const res = await axios.get(`${API_URL}/client/instances/${instanceId}/manifest`)
      const manifest = res.data

      await gameManager.installAndLaunch(instanceId, manifest, authData, memory)
      
    } catch (error: unknown) {
      gameManager.log(`❌ Critical Error: ${errorMessage(error)}`)
      console.error(error)
    }
  })
})
