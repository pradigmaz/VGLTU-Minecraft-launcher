import { contextBridge, ipcRenderer } from 'electron'

// API для рендера (UI)
const api = {
  // Запрос списка сборок
  getInstances: () => ipcRenderer.invoke('get-instances'),
  
  // Команда на запуск с параметром RAM
  launchGame: (instanceId, ram) => ipcRenderer.invoke('launch-game', instanceId, ram),
  
  // Логин через Yggdrasil
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  
  // Подписка на логи (консоль)
  onLog: (callback) => {
    const listener = (_event, text) => callback(text)
    ipcRenderer.on('log', listener)
    return () => ipcRenderer.removeListener('log', listener)
  },
  
  // Получение информации о системе (RAM)
  getSystemInfo: () => ipcRenderer.invoke('get-system-info')
}

// Выставляем в window.api
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}