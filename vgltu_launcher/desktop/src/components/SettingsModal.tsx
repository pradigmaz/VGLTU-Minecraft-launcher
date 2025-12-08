import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  totalRam: number
  currentRam: number
  onSave: (ram: number) => void
}

export const SettingsModal = ({ isOpen, onClose, totalRam, currentRam, onSave }: SettingsProps) => {
  const [ram, setRam] = useState(currentRam)

  // Синхронизация при открытии
  useEffect(() => {
    if (isOpen) setRam(currentRam)
  }, [isOpen, currentRam])

  if (!isOpen) return null

  // Лимиты: Мин 1ГБ, Макс (Всего - 1.5ГБ)
  const minRam = 1024
  const maxRam = Math.max(minRam, totalRam - 1536)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            Memory Allocation
          </label>
          
          <div className="slider-container">
            <input 
              type="range" 
              className="slider"
              min={minRam} 
              max={maxRam} 
              step={512}
              value={ram} 
              onChange={e => setRam(Number(e.target.value))}
            />
            <div style={{ textAlign: 'right', minWidth: '80px' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{ram} MB</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
            <span>Available: {totalRam} MB</span>
            <span>~{Math.floor(ram * 0.9)} MB in-game</span>
          </div>
        </div>

        <button 
          onClick={() => onSave(ram)}
          style={{
            width: '100%',
            padding: '10px',
            background: 'var(--accent-color)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Save size={18} /> Save Changes
        </button>
      </div>
    </div>
  )
}