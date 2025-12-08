import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import axios from 'axios'
import os from 'os'

const API_URL = "http://localhost:8000/api"

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers
ipcMain.handle('get-instances', async () => {
  return [
    {
      id: 'hitech-1.12.2',
      title: 'Faculty HiTech',
      version: '1.12.2',
      description: 'Industrial server with classic mods.'
    },
    {
      id: 'magic-1.20.1',
      title: 'Faculty Magic',
      version: '1.20.1',
      description: 'New magic RPG server.'
    }
  ]
})

ipcMain.handle('login', async (_event, username, password) => {
  const window = BrowserWindow.getAllWindows()[0]
  window.webContents.send('log', `🔐 Attempting login for ${username}...`)
  
  try {
    const res = await axios.post('http://localhost:8000/authserver/authenticate', {
      username,
      password,
      clientToken: 'pixellauncher-launcher-desktop'
    })
    
    window.webContents.send('log', `✅ Login successful! Welcome, ${res.data.selectedProfile.name}`)
    return { 
      success: true, 
      username: res.data.selectedProfile.name,
      accessToken: res.data.accessToken,
      uuid: res.data.selectedProfile.id
    }
  } catch (e) {
    const errorMsg = e.response?.data?.errorMessage || e.message
    window.webContents.send('log', `❌ Login failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
})

ipcMain.handle('launch-game', async (_event, instanceId, ram = 2048) => {
  const window = BrowserWindow.getAllWindows()[0]
  window.webContents.send('log', `🚀 Preparing to launch ${instanceId} with ${ram}MB RAM...`)
  window.webContents.send('log', `⏳ Fetching manifest from API...`)
  
  try {
    const res = await axios.get(`${API_URL}/client/instances/test-server-v1/manifest`)
    window.webContents.send('log', `✅ Manifest received! Files to download: ${res.data.files.length}`)
    // TODO: Интегрировать GameManager
    // await gameManager.installAndLaunch(instanceId, res.data, authData, ram)
  } catch (e) {
    window.webContents.send('log', `❌ Error connecting to API: ${e.message}`)
    window.webContents.send('log', `💡 Hint: Is Docker Backend running?`)
  }
})

ipcMain.handle('get-system-info', async () => {
  const totalRam = Math.floor(os.totalmem() / 1024 / 1024)
  return { totalRam }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
