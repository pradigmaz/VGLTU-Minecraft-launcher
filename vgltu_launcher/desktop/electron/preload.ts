import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getInstances: () => ipcRenderer.invoke('get-instances'),
  launchGame: (instanceId: string, ram: number) => ipcRenderer.invoke('launch-game', instanceId, ram),
  login: (username: string, password: string) => ipcRenderer.invoke('login', username, password),
  
  onLog: (callback: (text: string) => void) => {
    const handler = (_event: any, text: string) => callback(text)
    ipcRenderer.on('log', handler)
    return () => ipcRenderer.removeListener('log', handler)
  },

  onProgress: (callback: (data: { task: string, details: string, percent: number }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('progress', handler)
    return () => ipcRenderer.removeListener('progress', handler)
  },

  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // === НОВОЕ: Открытие ссылок ===
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // === Environment variables ===
  BOT_USERNAME: process.env.BOT_USERNAME || 'vgltuminecraftbot'
}

contextBridge.exposeInMainWorld('api', api)