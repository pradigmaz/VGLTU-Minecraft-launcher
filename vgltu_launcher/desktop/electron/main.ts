import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'path'
import axios from 'axios'
import os from 'os'
import fs from 'fs' // Импортируем fs для сохранения конфига
import { GameManager } from './game-manager'
import { getApiUrl } from './config'

// ОПТИМИЗАЦИЯ RAM
app.disableHardwareAcceleration();

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.join(app.getPath('userData'), 'profile.json') // Путь к профилю пользователя

// URL загружается лениво после app.whenReady()
let API_BASE = ''
let API_URL = ''
let AUTH_URL = ''

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

  // --- LOGIN LOGIC UPDATE ---
  ipcMain.handle('login', async (_event, username: string, _password: string) => {
    try {
      gameManager.log(`🔐 Attempting login for ${username}...`)
      
      let telegramId: number;

      // 1. Пытаемся загрузить ID из файла
      try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            if (config.username === username && config.telegramId) {
                telegramId = config.telegramId;
                gameManager.log(`📂 Found saved profile for ID: ${telegramId}`);
            } else {
                throw new Error("New user");
            }
        } else {
            throw new Error("No config");
        }
      } catch (err) {
        // 2. Если файла нет или юзер другой -> генерируем новый ID
        telegramId = Math.floor(Math.random() * 10000000);
        gameManager.log(`🆕 Generating new ID: ${telegramId}`);
        
        // Сохраняем новый ID
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ username, telegramId }));
      }
      
      // 3. Регистрируем/Обновляем пользователя на бэке
      try {
        await axios.post(`${AUTH_URL}/api/dev/create_user`, {
            username: username,
            telegram_id: telegramId 
        })
      } catch (err) { 
          // Игнорируем ошибку "пользователь уже существует"
      }

      // 4. Авторизуемся
      const res = await axios.post(`${AUTH_URL}/authserver/authenticate`, {
        username,
        password: "dummy_password", // Это ок для dev-режима
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