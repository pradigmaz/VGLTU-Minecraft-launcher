import { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'
import '../App.css'

interface ConsoleProps {
  logs: string[]
}

export const Console = ({ logs }: ConsoleProps) => {
  const endRef = useRef<HTMLDivElement>(null)

  // Авто-скролл вниз при новых логах
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="console-wrapper" style={{
      background: '#000', 
      border: '1px solid var(--border-color)', 
      borderRadius: '8px', 
      display: 'flex', 
      flexDirection: 'column',
      height: '200px',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '8px 12px', 
        borderBottom: '1px solid #333', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        color: '#666',
        fontSize: '0.8rem',
        background: '#0f0f11'
      }}>
        <Terminal size={14} /> 
        <span>SYSTEM CONSOLE</span>
      </div>
      
      <div style={{ 
        padding: '12px', 
        overflowY: 'auto', 
        fontFamily: 'Consolas, monospace', 
        fontSize: '0.85rem',
        flex: 1 
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{ 
            marginBottom: '4px',
            color: log.includes('Error') ? 'var(--error)' : log.includes('✅') ? 'var(--success)' : '#d4d4d8' 
          }}>
            <span style={{opacity: 0.5, marginRight: '8px'}}>{log.split(']')[0]}]</span>
            {log.split(']').slice(1).join(']')}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}