import { useState, useEffect } from 'react'
import { Play, Terminal, Server } from 'lucide-react'

// Хакерские стили
const styles = {
  container: { padding: '2rem', height: '100vh', background: '#09090b', color: '#e4e4e7', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  card: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' },
  title: { margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 'bold' },
  badge: { background: '#27272a', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 'bold' },
  desc: { color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.4', marginBottom: '1rem' },
  btn: { width: '100%', padding: '0.8rem', background: '#2563eb', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.9rem' },
  console: { marginTop: 'auto', background: '#000', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', height: '180px', overflowY: 'auto', border: '1px solid #333' }
}

function App() {
  const [instances, setInstances] = useState([])
  const [logs, setLogs] = useState([])

  useEffect(() => {
    // 1. Получаем список сборок при старте
    window.api.getInstances().then(data => {
      setInstances(data)
      addLog(`✅ System initialized. Found ${data.length} instances.`)
    })
    
    // 2. Слушаем логи из Main process
    window.api.onLog((text) => addLog(text))
  }, [])

  const addLog = (text) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`])
  }

  const handlePlay = (id) => {
    addLog(`🖱️ User clicked Play on ${id}`)
    window.api.launchGame(id)
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Server size={32} color="#2563eb" />
        <h1 style={{ margin: 0 }}>Pixel Launcher v3.0</h1>
      </div>
      
      <div style={styles.grid}>
        {instances.map(inst => (
          <div key={inst.id} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
              <div style={styles.title}>{inst.title}</div>
              <span style={styles.badge}>{inst.version}</span>
            </div>
            <p style={styles.desc}>{inst.description}</p>
            <button style={styles.btn} onClick={() => handlePlay(inst.id)}>
              <Play size={18} /> PLAY
            </button>
          </div>
        ))}
      </div>

      <div style={styles.console}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#666', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
          <Terminal size={14} /> SYSTEM CONSOLE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ color: log.includes('Error') ? '#ef4444' : log.includes('✅') ? '#22c55e' : '#d4d4d8' }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App