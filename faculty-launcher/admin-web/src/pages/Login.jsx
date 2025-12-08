import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import api from '../lib/api';

export default function Login() {
  const [code, setCode] = useState(null);
  const [botLink, setBotLink] = useState(null);
  const navigate = useNavigate();

  // 1. Получаем код при загрузке
  useEffect(() => {
    api.get('/auth/code')
      .then(res => {
        setCode(res.data.code);
        setBotLink(res.data.bot_link);
      })
      .catch(err => {
        console.error("Failed to get auth code", err);
      });
  }, []);

  // 2. Опрашиваем сервер каждые 2 секунды
  useEffect(() => {
    if (!code) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/auth/check/${code}`);
        if (res.data.status === 'success') {
          localStorage.setItem('token', res.data.access_token);
          navigate('/');
        }
      } catch (e) {
        // 404 = код истёк, остальные ошибки игнорируем
        if (e.response?.status === 404) {
          clearInterval(interval);
        }
      }
    }, 3000); // Увеличен интервал с 2 до 3 секунд

    return () => clearInterval(interval);
  }, [code, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="bg-surface p-8 rounded-xl border border-border max-w-md w-full text-center shadow-2xl">
        <h1 className="text-2xl font-bold mb-2">Faculty Admin</h1>
        <p className="text-muted mb-6">Secure Gateway</p>

        {!code ? (
          <Loader2 className="animate-spin mx-auto text-primary" size={32} />
        ) : (
          <div className="space-y-6">
            <div className="bg-black/50 p-4 rounded-lg border border-border font-mono text-xl tracking-wider text-primary">
              {code.slice(0, 8)}...
            </div>
            
            <a 
              href={botLink} 
              target="_blank" 
              className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-lg font-medium transition-all"
            >
              <Send size={18} />
              Open Telegram Bot
            </a>

            <p className="text-xs text-muted">
              Нажмите кнопку или отправьте боту команду:<br/>
              <code className="bg-black/30 px-1 rounded">/start {code}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}