import { Play } from 'lucide-react'

interface CardProps {
  inst: any
  onPlay: (id: string) => void
}

export const InstanceCard = ({ inst, onPlay }: CardProps) => {
  return (
    <div className="fade-in" style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.5rem',
      position: 'relative',
      transition: 'transform 0.2s, border-color 0.2s',
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-color)';
        e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{inst.title}</h3>
        <span style={{
          background: '#27272a',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#a1a1aa'
        }}>{inst.mc_version}</span>
      </div>

      <div style={{ marginBottom: '1.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
        Loader: <span style={{color: '#fff'}}>{inst.loader_type}</span>
      </div>

      <button 
        onClick={() => onPlay(inst.id)}
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
          cursor: 'pointer',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-color)'}
      >
        <Play size={18} fill="currentColor" /> PLAY
      </button>
    </div>
  )
}