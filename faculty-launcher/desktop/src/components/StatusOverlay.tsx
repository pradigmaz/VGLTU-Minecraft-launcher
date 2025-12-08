import { Loader2 } from 'lucide-react'

interface StatusOverlayProps {
  message: string | null
  details?: string
  progress?: number // 0 to 100
}

export const StatusOverlay = ({ message, details, progress }: StatusOverlayProps) => {
  if (!message) return null;

  return (
    <div className="fade-in" style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(9, 9, 11, 0.9)', // Чуть темнее
      backdropFilter: 'blur(8px)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      transition: 'opacity 0.3s'
    }}>
      <Loader2 size={48} className="spin" style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }} />
      
      {/* Главный статус */}
      <div style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>{message}</div>
      
      {/* Детали (какой файл качается) */}
      {details && (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '1.5rem', height: '20px' }}>
          {details}
        </div>
      )}

      {/* Прогресс бар */}
      {progress !== undefined && (
        <div style={{ width: '300px', height: '6px', background: '#27272a', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: 'var(--accent-color)',
            width: `${progress}%`,
            transition: 'width 0.2s ease-out', // Плавная анимация полоски
            boxShadow: '0 0 10px var(--accent-color)'
          }} />
        </div>
      )}
    </div>
  )
}