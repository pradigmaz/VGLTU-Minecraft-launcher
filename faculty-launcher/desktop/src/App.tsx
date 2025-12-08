import { useState, useEffect, useCallback } from 'react'
import './App.css'

// Компоненты (которые мы создали ранее)
import { Header } from './components/Header'
import { Console } from './components/Console'
import { InstanceCard } from './components/InstanceCard'
import { StatusOverlay } from './components/StatusOverlay'
import { SettingsModal } from './components/SettingsModal'

// Типизация API из preload (см. electron/preload.ts)
interface WindowApi {
  getInstances: () => Promise<any[]>
  launchGame: (id: string, ram?: number) => Promise<void>
  login: (username: string, password: string) => Promise<{ success: boolean; username?: string; error?: string }>
  onLog: (callback: (text: string) => void) => () => void
  onProgress: (callback: (data: { task: string, details: string, percent: number }) => void) => () => void
  getSystemInfo: () => Promise<{ totalRam: number }>
  openExternal: (url: string) => void
  BOT_USERNAME: string
}

declare const window: Window & { api: WindowApi }

function App() {
  const [instances, setInstances] = useState<any[]>([])
  const [logs, setLogs] = useState<string[]>([])
  
  // Auth State
  const [user, setUser] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  
  // UI State
  const [refreshing, setRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // Settings State
  const [systemRam, setSystemRam] = useState(8192)
  const [selectedRam, setSelectedRam] = useState(2048)

  // Добавляем стейты для прогресса
  const [progressData, setProgressData] = useState<{ task: string, details: string, percent: number } | null>(null)

  const addLog = useCallback((text: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`])
  }, [])

  const loadInstances = useCallback(async (isManual = false) => {
    if (isManual) {
        setRefreshing(true)
        addLog('🔄 Checking for remote updates...')
    }
    try {
      const data = await window.api.getInstances()
      setInstances(data)
      if(isManual) addLog('✅ Instance list updated.')
    } catch (err) {
      addLog('❌ Failed to fetch instances.')
    } finally {
      setRefreshing(false)
    }
  }, [addLog])

  // Логика входа
  const handleLogin = async (username: string) => {
    setLoginLoading(true)
    const result = await window.api.login(username, 'dummy_pass')
    setLoginLoading(false)
    if (result.success) {
      setUser(result.username || username)
      localStorage.setItem('faculty_username', username)
    }
  }

  // Логика выхода
  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('faculty_username')
    addLog("👋 Logged out.")
  }

  // Сохранение настроек RAM
  const handleSaveSettings = (newRam: number) => {
      setSelectedRam(newRam)
      localStorage.setItem('faculty_ram', String(newRam))
      setShowSettings(false)
      addLog(`💾 RAM allocation set to ${newRam}MB`)
  }

  // Запуск игры
  const handlePlay = async (id: string) => {
    if (!user) return alert('Login first!')
    
    // Сбрасываем прогресс перед стартом
    setProgressData({ task: 'Initializing...', details: 'Preparing environment', percent: 0 })
    addLog(`🚀 Launching sequence for ${id}...`)
    
    try {
        await window.api.launchGame(id, selectedRam)
        // Скрываем оверлей с задержкой, чтобы юзер увидел 100%
        setTimeout(() => setProgressData(null), 1000) 
    } catch (e) {
        setProgressData(null)
    }
  }

  // Инициализация при старте
  useEffect(() => {
    loadInstances()
    
    // Подписка на Логи
    const unsubLog = window.api.onLog((text) => addLog(text))
    
    // === Подписка на Прогресс ===
    const unsubProgress = window.api.onProgress((data) => {
        // Если пришло "Done" или 100% на финише — скрываем оверлей (или обрабатываем завершение)
        if (data.percent >= 100 && data.task === 'Launch') {
             // Можно тут скрыть, но у нас логика handlePlay
    }
        setProgressData(data)
    })

    // Авто-логин
    const savedUser = localStorage.getItem('faculty_username')
    if (savedUser) {
        handleLogin(savedUser)
    }

    // Получение инфо о системе для ползунка
    window.api.getSystemInfo().then(info => {
        setSystemRam(info.totalRam)
        const savedRam = localStorage.getItem('faculty_ram')
        if (savedRam) setSelectedRam(Number(savedRam))
        else setSelectedRam(Math.min(4096, Math.floor(info.totalRam / 2)))
    })

    return () => {
        unsubLog()
        unsubProgress()
    }
  }, [loadInstances, addLog])

  return (
    <div className="container">
      {/* Передаем данные прогресса в оверлей */}
      <StatusOverlay 
        message={progressData?.task || null} 
        details={progressData?.details}
        progress={progressData?.percent}
      />

      {/* Модалка настроек */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        totalRam={systemRam}
        currentRam={selectedRam}
        onSave={handleSaveSettings}
      />

      {/* Хедер */}
      <Header 
        user={user}
        refreshing={refreshing}
        loginLoading={loginLoading}
        onRefresh={() => loadInstances(true)}
        onOpenSettings={() => setShowSettings(true)}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Сетка сборок */}
      <div className="grid">
        {instances.length === 0 ? (
            <div style={{ 
                border: '1px dashed var(--border-color)', 
                borderRadius: '12px', 
                padding: '3rem', 
                textAlign: 'center', 
                color: 'var(--text-dim)',
                gridColumn: '1 / -1',
                background: 'rgba(255,255,255,0.02)'
            }}>
                No instances found on server. Try refreshing.
            </div>
        ) : (
            instances.map(inst => (
                <InstanceCard key={inst.id} inst={inst} onPlay={handlePlay} />
            ))
        )}
      </div>

      {/* Консоль */}
      <Console logs={logs} />
    </div>
  )
}

export default App