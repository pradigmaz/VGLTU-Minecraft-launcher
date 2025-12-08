import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'path'
import axios from 'axios'
import os from 'os' 
import { GameManager } from './game-manager'

// ОПТИМИЗАЦИЯ RAM: Отключаем аппаратное ускорение
// Лаунчеру не нужна видеокарта, это экономит ~100 МБ памяти сразу.
app.disableHardwareAcceleration();

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Конфигурация API (можно переопределить через env)
const API_BASE = process.env.FACULTY_API_URL || "http://localhost:8000"
const API_URL = `${API_BASE}/api`
const AUTH_URL = API_BASE

let authData: { username: string; uuid: string; accessToken: string } | null = null
let mainWindow: BrowserWindow | null = null

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
    show: false // ОПТИМИЗАЦИЯ: Не показываем белое окно во время загрузки
  })

  // CSP для защиты от XSS
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

  // Показываем окно только когда интерфейс отрисовался
  win.once('ready-to-show', () => {
    win.show()
  })

  return win
}

app.whenReady().then(() => {
  mainWindow = createWindow()
  
  // Передаем окно в менеджер для "Stealth Mode" (скрытия при игре)
  const gameManager = new GameManager(mainWindow)

  // 1. SYSTEM INFO
  ipcMain.handle('get-system-info', () => {
    return {
      totalRam: Math.floor(os.totalmem() / 1024 / 1024)
    }
  })

  // 2. OPEN LINKS
  ipcMain.handle('open-external', async (_event, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
          await shell.openExternal(url)
      }
  })

  // 3. GET INSTANCES
  ipcMain.handle('get-instances', async () => {
     try {
       const res = await axios.get(`${API_URL}/client/instances`)
       const instances = res.data
       gameManager.cleanOldInstances(instances).catch(console.error)
       return instances
     } catch (e) {
       console.error("Failed to fetch instances", e)
       return [] 
     }
  })

  // 4. LOGIN
  ipcMain.handle('login', async (_event, username: string, _password: string) => {
    try {
      gameManager.log(`🔐 Attempting login for ${username}...`)
      const fakeTgId = Math.floor(Math.random() * 1000000)
      
      try {
        await axios.post(`${AUTH_URL}/api/dev/create_user`, {
            username: username,
            telegram_id: fakeTgId 
        })
      } catch (err) { }

      const res = await axios.post(`${AUTH_URL}/authserver/authenticate`, {
        username,
        password: "dummy_password",
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
    } catch (e: any) {
      gameManager.log(`❌ Login failed: ${e.response?.data?.detail || e.message}`)
      return { success: false, error: e.response?.data?.detail || e.message }
    }
  })

  // 5. LAUNCH
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
      
    } catch (e: any) {
      gameManager.log(`❌ Critical Error: ${e.message}`)
      console.error(e)
    }
  })
})