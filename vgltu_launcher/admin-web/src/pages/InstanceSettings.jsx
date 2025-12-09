import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Server, RefreshCw, Save, Terminal, FolderCog, AlertTriangle, Activity } from 'lucide-react';
import api from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import FileManager from './FileManager'; 

export default function InstanceSettings() {
  const { id } = useParams();
  const { t } = useLanguage(); 
  const [activeTab, setActiveTab] = useState('files');
  
  // SFTP State
  const [sftpConfig, setSftpConfig] = useState({
    host: '', 
    port: 2022, 
    username: '', 
    password: '',
    sync_mods: true, 
    sync_config: true,
    sync_scripts: false,
    sync_shaderpacks: false,
    sync_resourcepacks: false
  });
  
  const [syncLogs, setSyncLogs] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Загрузка конфига
  useEffect(() => {
    if (activeTab === 'deployment') {
        setLoadingConfig(true);
        api.get(`/admin/sftp/${id}`)
           .then(res => setSftpConfig(res.data))
           .catch(() => console.log("Конфиг не найден, создаем новый."))
           .finally(() => setLoadingConfig(false));
    }
  }, [activeTab, id]);

  const saveConfig = async () => {
    try {
        await api.post(`/admin/sftp/${id}`, sftpConfig);
        alert(t('settingsSaved'));
    } catch (e) {
        alert(t('saveError') + (e.response?.data?.detail || e.message));
    }
  };

  const runSync = async () => {
    if (!confirm(t('syncConfirm'))) return;
    
    setSyncing(true);
    const time = new Date().toLocaleTimeString();
    
    // 1. МГНОВЕННЫЙ ОТКЛИК В ЛОГ
    setSyncLogs(prev => prev + `\n[${time}] 🚀 ${t('syncInitializing')} ${id}...\n`);
    setSyncLogs(prev => prev + `[${time}] ⏳ ${t('connectingSFTP')}\n`);
    
    try {
        const res = await api.post(`/admin/sftp/${id}/sync`);
        setSyncLogs(prev => prev + res.data.logs + `\n✅ ${t('syncSuccess')}\n`);
    } catch (e) {
        setSyncLogs(prev => prev + `❌ ${t('syncError')}${e.response?.data?.detail || e.message}\n`);
    } finally {
        setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-muted hover:text-text">
            <ArrowLeft size={24} />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-text">{id}</h1>
            <p className="text-sm text-muted">{t('instanceSettings')}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button 
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
            <FolderCog size={18} /> {t('fileManagerTab')}
        </button>
        <button 
            onClick={() => setActiveTab('deployment')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === 'deployment' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
            <Server size={18} /> {t('syncTab')}
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* --- TAB 1: FILES --- */}
        {activeTab === 'files' && <FileManager />}
        
        {/* --- TAB 2: DEPLOYMENT --- */}
        {activeTab === 'deployment' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* LEFT COLUMN: SETTINGS */}
                <div className="space-y-6">
                    {/* ПЛАШКА-НАПОМИНАНИЕ (АДАПТИВНАЯ) */}
                    <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 p-4 rounded-xl flex gap-3 text-yellow-900 dark:text-yellow-400">
                        <AlertTriangle className="shrink-0 text-yellow-600 dark:text-yellow-500" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">{t('manualSyncWarning')}</p>
                            <p className="opacity-90">{t('manualSyncDesc')}</p>
                        </div>
                    </div>

                    <div className="bg-surface border border-border p-6 rounded-xl shadow-sm h-fit">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text">
                            <Server className="text-primary" size={20}/> {t('connectionSettings')}
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-muted mb-1 uppercase">{t('host')}</label>
                                    <input 
                                        value={sftpConfig.host} 
                                        onChange={e => setSftpConfig({...sftpConfig, host: e.target.value})} 
                                        className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text placeholder:text-muted/50" 
                                        placeholder="192.168.1.1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted mb-1 uppercase">{t('port')}</label>
                                    <input 
                                        type="number" 
                                        value={sftpConfig.port} 
                                        onChange={e => setSftpConfig({...sftpConfig, port: parseInt(e.target.value)})} 
                                        className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-muted mb-1 uppercase">{t('sftpLogin')}</label>
                                <input 
                                    value={sftpConfig.username} 
                                    onChange={e => setSftpConfig({...sftpConfig, username: e.target.value})} 
                                    className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted mb-1 uppercase">{t('sftpPassword')}</label>
                                <input 
                                    type="password" 
                                    value={sftpConfig.password} 
                                    onChange={e => setSftpConfig({...sftpConfig, password: e.target.value})} 
                                    className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text"
                                />
                            </div>

                            <div className="pt-4 border-t border-border">
                                <label className="block text-xs font-bold text-muted mb-3 uppercase">{t('whatToSync')}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        {key: 'mods', label: t('modsFolder')},
                                        {key: 'config', label: t('configFolder')},
                                        {key: 'scripts', label: t('scriptsFolder')},
                                        {key: 'shaderpacks', label: t('shadersFolder')},
                                        {key: 'resourcepacks', label: t('resourcesFolder')}
                                    ].map(item => (
                                        <label key={item.key} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors text-text">
                                            <input 
                                                type="checkbox" 
                                                checked={sftpConfig[`sync_${item.key}`]} 
                                                onChange={e => setSftpConfig({...sftpConfig, [`sync_${item.key}`]: e.target.checked})} 
                                                className="accent-primary w-4 h-4 rounded border-gray-300"
                                            />
                                            <span className="text-sm">{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={saveConfig} 
                                disabled={loadingConfig}
                                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-black/5 dark:bg-white/5 border border-border hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors font-medium text-text"
                            >
                                <Save size={18}/> {t('saveSettings')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: ACTIONS & LOGS */}
                <div className="flex flex-col gap-4 h-full min-h-[600px]">
                    <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
                        <h2 className="text-lg font-bold mb-2 text-text">{t('actions')}</h2>
                        <p className="text-sm text-muted mb-4">
                            {t('syncDescription')}
                        </p>
                        
                        <button 
                            onClick={runSync} 
                            disabled={syncing || !sftpConfig.host} 
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                        >
                            {syncing ? (
                                <>
                                    <RefreshCw className="animate-spin" size={20}/>
                                    <span>{t('syncing')}</span>
                                    {/* Индикатор прогресса */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-white/30 animate-[progress_2s_infinite_linear] w-full"></div>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={20}/>
                                    <span>{t('startSync')}</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* ТЕРМИНАЛ (ЛОГИ) - АДАПТИВНЫЙ */}
                    <div className="flex-1 bg-surface rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col border border-border shadow-inner relative transition-colors">
                        <div className="flex items-center justify-between text-muted mb-2 border-b border-border pb-2 uppercase tracking-wider font-bold">
                            <div className="flex items-center gap-2">
                                <Terminal size={14}/> {t('operationLog')}
                            </div>
                            {syncing && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                    <Activity size={14} className="animate-pulse"/>
                                    <span className="text-[10px]">{t('live')}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                            {syncLogs ? (
                                <pre className="whitespace-pre-wrap text-text font-mono leading-relaxed">
                                    {syncLogs}
                                    {syncing && <span className="animate-pulse inline-block ml-1 w-2 h-4 bg-muted align-middle"></span>}
                                </pre>
                            ) : (
                                <div className="text-muted italic mt-4 text-center">
                                    {t('waitingForStart')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        )}
      </div>
    </div>
  );
}