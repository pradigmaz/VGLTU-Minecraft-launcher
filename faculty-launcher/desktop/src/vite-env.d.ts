/// <reference types="vite/client" />

interface Window {
  api: {
    getInstances: () => Promise<any[]>
    launchGame: (id: string, ram?: number) => Promise<void>
    login: (username: string, password: string) => Promise<{ success: boolean; username?: string; error?: string }>
    onLog: (callback: (text: string) => void) => () => void
    onProgress: (callback: (data: { task: string; details: string; percent: number }) => void) => () => void
    getSystemInfo: () => Promise<any>
    openExternal: (url: string) => Promise<void>
    BOT_USERNAME: string
  }
}
