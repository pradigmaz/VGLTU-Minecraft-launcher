import { useState } from 'react'
import { Server, RefreshCw, Settings, LogOut, Loader2, MessageSquarePlus } from 'lucide-react' // <--- Добавил иконку

interface HeaderProps {
  user: string | null
  refreshing: boolean
  loginLoading: boolean
  onRefresh: () => void
  onOpenSettings: () => void
  onLogin: (username: string) => void
  onLogout: () => void
}


const FEEDBACK_URL = `https://t.me/${window.api.BOT_USERNAME}?start=feedback`;

export const Header = ({ 
  user, 
  refreshing, 
  loginLoading, 
  onRefresh, 
  onOpenSettings, 
  onLogin, 
  onLogout 
}: HeaderProps) => {
  const [usernameInput, setUsernameInput] = useState('')

  const handleLoginClick = () => {
    if (usernameInput.trim()) {
      onLogin(usernameInput)
    }
  }

  const handleFeedback = () => {
    // Открываем ссылку во внешнем браузере
    window.api.openExternal(FEEDBACK_URL);
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
      {/* LOGO AREA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #2563eb, #9333ea)', 
          padding: '8px', 
          borderRadius: '8px', 
          boxShadow: '0 0 15px rgba(37, 99, 235, 0.3)' 
        }}>
          <Server color="white" size={24} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.2rem', lineHeight: 1 }}>Pixel Launcher</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>v3.2 Stable</span>
        </div>
      </div>

      {/* ACTIONS AREA */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        
        {/* Feedback Button (NEW) */}
        <button 
          onClick={handleFeedback}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', transition: 'color 0.2s' }}
          title="Feedback / Предложения"
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <MessageSquarePlus size={20} />
        </button>

        {/* Refresh Button */}
        <button 
          onClick={onRefresh} 
          className={refreshing ? 'spin' : ''}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', transition: 'color 0.2s' }}
          title="Check for updates"
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <RefreshCw size={20} />
        </button>

        {/* Settings Button */}
        <button 
          onClick={onOpenSettings}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', transition: 'color 0.2s' }}
          title="Settings"
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <Settings size={20} />
        </button>

        {/* AUTH BLOCK */}
        {user ? (
          <div style={{ 
            background: 'var(--card-bg)', 
            padding: '6px 12px', 
            borderRadius: '20px', 
            border: '1px solid var(--border-color)',
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px'
          }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 8px var(--success)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user}</span>
            <button 
              onClick={onLogout} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-dim)' }}
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              value={usernameInput} 
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoginClick()}
              placeholder="Username"
              style={{ 
                background: '#000', 
                border: '1px solid var(--border-color)', 
                borderRadius: '6px', 
                padding: '6px 10px', 
                color: 'white', 
                outline: 'none', 
                width: '120px',
                fontSize: '0.9rem'
              }}
            />
            <button 
              onClick={handleLoginClick}
              disabled={loginLoading}
              style={{ 
                background: 'var(--accent-color)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                padding: '6px 12px', 
                cursor: 'pointer', 
                fontWeight: 600,
                fontSize: '0.9rem',
                minWidth: '60px',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              {loginLoading ? <Loader2 size={16} className="spin" /> : 'Login'}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}