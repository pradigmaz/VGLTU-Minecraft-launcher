/// <reference types="vite/client" />

interface LauncherInstance {
  id: string
  title: string
  mc_version: string
  loader_type: string
}

interface LauncherProgress {
  task: string
  details: string
  percent: number
}

interface LauncherSystemInfo {
  totalRam: number
}

interface Window {
  api: {
    getInstances: () => Promise<LauncherInstance[]>
    launchGame: (id: string, ram?: number) => Promise<void>
    login: (username: string, password: string) => Promise<{ success: boolean; username?: string; error?: string }>
    onLog: (callback: (text: string) => void) => () => void
    onProgress: (callback: (data: LauncherProgress) => void) => () => void
    getSystemInfo: () => Promise<LauncherSystemInfo>
    openExternal: (url: string) => Promise<void>
    BOT_USERNAME: string
  }
}
