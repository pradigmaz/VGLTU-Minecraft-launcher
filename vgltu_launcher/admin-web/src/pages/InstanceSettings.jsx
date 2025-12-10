import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Server, RefreshCw, Save, Terminal, FolderCog, 
  AlertTriangle, Activity, Command, HelpCircle, Check, X, Shield,
  HardDrive, Globe, ChevronRight
} from 'lucide-react';
import api from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import FileManager from './FileManager'; 

// --- MODALS ---

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
                <p className="text-muted mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-text font-medium transition-colors">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold transition-colors shadow-lg shadow-primary/20">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Новый компонент: Помощник по RCON
const RconHelpModal = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const [serverType, setServerType] = useState(null); // 'hosting' | 'vps'

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in slide-in-from-bottom-5 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-black/5 dark:bg-white/5">
                    <h3 className="font-bold text-text flex items-center gap-2">
                        <HelpCircle size={18} className="text-primary"/> 
                        {serverType ? (serverType === 'hosting' ? t('hostingGuideTitle') : t('vpsGuideTitle')) : t('serverTypeTitle')}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-muted transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!serverType ? (
                        // Шаг 1: Выбор типа сервера
                        <div className="grid gap-4">
                            <button 
                                onClick={() => setServerType('hosting')}
                                className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group text-left"
                            >
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                                    <Globe size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-text mb-1">{t('typeHosting')}</h4>
                                    <p className="text-xs text-muted">{t('typeHostingDesc')}</p>
                                </div>
                                <ChevronRight className="ml-auto text-muted group-hover:text-primary" />
                            </button>

                            <button 
                                onClick={() => setServerType('vps')}
                                className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group text-left"
                            >
                                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg group-hover:scale-110 transition-transform">
                                    <HardDrive size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-text mb-1">{t('typeVps')}</h4>
                                    <p className="text-xs text-muted">{t('typeVpsDesc')}</p>
                                </div>
                                <ChevronRight className="ml-auto text-muted group-hover:text-primary" />
                            </button>
                        </div>
                    ) : (
                        // Шаг 2: Инструкция
                        <div className="animate-in fade-in slide-in-from-right-5 duration-200">
                            <div className="space-y-4 text-sm text-text leading-relaxed">
                                {serverType === 'hosting' ? (
                                    <>
                                        <p className="flex gap-3"><span className="font-bold text-primary shrink-0">1.</span> {t('hostingGuideStep1')}</p>
                                        <p className="flex gap-3"><span className="font-bold text-primary shrink-0">2.</span> {t('hostingGuideStep2')}</p>
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                                            💡 {t('hostingGuideStep3')}
                                        </div>
                                        <p className="flex gap-3"><span className="font-bold text-primary shrink-0">4.</span> {t('hostingGuideStep4')}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="flex gap-3"><span className="font-bold text-orange-500 shrink-0">1.</span> {t('vpsGuideStep1')}</p>
                                        <div className="bg-black/80 text-gray-300 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                                            enable-rcon=true<br/>
                                            rcon.port=25575<br/>
                                            rcon.password=secret
                                        </div>
                                        <p className="flex gap-3"><span className="font-bold text-orange-500 shrink-0">2.</span> {t('vpsGuideStep2')}</p>
                                        <p className="flex gap-3"><span className="font-bold text-orange-500 shrink-0">3.</span> {t('vpsGuideStep4')}</p>
                                    </>
                                )}
                            </div>
                            <button 
                                onClick={() => setServerType(null)}
                                className="mt-6 text-xs text-muted hover:text-text flex items-center gap-1 transition-colors"
                            >
                                <ArrowLeft size={12} /> {t('cancel')} / Назад
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
            {type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            <span className="font-medium">{message}</span>
        </div>
    );
};

// --- MAIN PAGE ---

export default function InstanceSettings() {
  const { id } = useParams();
  const { t } = useLanguage(); 
  const [activeTab, setActiveTab] = useState('files');
  
  // Config State
  const [sftpConfig, setSftpConfig] = useState({
    host: '', port: 2022, username: '', password: '',
    rcon_host: '', rcon_port: 25575, rcon_password: '',
    sync_mods: true, sync_config: true, sync_scripts: false, 
    sync_shaderpacks: false, sync_resourcepacks: false
  });

  const [syncLogs, setSyncLogs] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  // UX State
  const [rconEnabled, setRconEnabled] = useState(false);
  const [useSftpHost, setUseSftpHost] = useState(true);
  const [showRconHelp, setShowRconHelp] = useState(false); // Для модалки помощи
  
  // Modal State
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (activeTab === 'deployment') {
        setLoadingConfig(true);
        api.get(`/admin/sftp/${id}`)
           .then(res => {
               const data = res.data;
               setSftpConfig({
                   ...data,
                   rcon_host: data.rcon_host || '',
                   rcon_password: data.rcon_password || '', 
                   password: data.password || '' 
               });
               if (data.rcon_password || data.rcon_port !== 25575) {
                   setRconEnabled(true);
               }
               if (!data.rcon_host || data.rcon_host === data.host) {
                   setUseSftpHost(true);
               } else {
                   setUseSftpHost(false);
               }
           })
           .catch(() => console.log("Config not found"))
           .finally(() => setLoadingConfig(false));
    }
  }, [activeTab, id]);

  const handleSave = async () => {
    try {
        const payload = { ...sftpConfig };
        if (useSftpHost) payload.rcon_host = payload.host;
        await api.post(`/admin/sftp/${id}`, payload);
        setToast({ message: t('saveSuccessMessage'), type: 'success' });
    } catch (e) {
        setToast({ message: t('saveError') + (e.response?.data?.detail || e.message), type: 'error' });
    }
  };

  const handleSyncClick = () => setConfirmModal({ isOpen: true, type: 'sync' });

  const handleConfirmAction = async () => {
      setConfirmModal({ ...confirmModal, isOpen: false });
      if (confirmModal.type === 'sync') await executeSync();
      else if (confirmModal.type === 'stop') setToast({ message: t('serverStopped'), type: 'success' });
  };

  const executeSync = async () => {
    setSyncing(true);
    const time = new Date().toLocaleTimeString();
    setSyncLogs(prev => prev + `\n[${time}] 🚀 ${t('syncInitializing')} ${id}...\n`);
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
    <div className="min-h-screen flex flex-col pb-10">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-muted hover:text-text">
            <ArrowLeft size={24} />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-text">{id}</h1>
            <p className="text-sm text-muted">{t('instanceSettings')}</p>
        </div>
      </div>

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

      <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          title={confirmModal.type === 'sync' ? t('syncConfirmTitle') : t('sendStopConfirm')}
          message={confirmModal.type === 'sync' ? t('syncConfirmMessage') : t('sendStopConfirm')}
          confirmText={t('confirmAction')}
          cancelText={t('cancelAction')}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
      
      {/* Help Modal */}
      <RconHelpModal isOpen={showRconHelp} onClose={() => setShowRconHelp(false)} />
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'files' && <FileManager />}
        
        {activeTab === 'deployment' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 p-4 rounded-xl flex gap-3 text-blue-900 dark:text-blue-300">
                        <AlertTriangle className="shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="text-sm leading-relaxed">
                            <p className="font-bold mb-1">{t('manualSyncWarning')}</p>
                            <p className="opacity-90">{t('manualSyncDesc')}</p>
                        </div>
                    </div>

                    {/* SFTP */}
                    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-black/5 dark:bg-white/5 px-6 py-4 border-b border-border flex items-center justify-between">
                            <h2 className="font-bold text-text flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> {t('sftpSection')}
                            </h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-text mb-1.5">{t('host')}</label>
                                    <input 
                                        value={sftpConfig.host} 
                                        onChange={e => setSftpConfig({...sftpConfig, host: e.target.value})} 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-text placeholder:text-muted/50" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text mb-1.5">{t('port')}</label>
                                    <input 
                                        type="number" 
                                        value={sftpConfig.port} 
                                        onChange={e => setSftpConfig({...sftpConfig, port: parseInt(e.target.value)})} 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-text"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text mb-1.5">{t('sftpLogin')}</label>
                                    <input 
                                        value={sftpConfig.username} 
                                        onChange={e => setSftpConfig({...sftpConfig, username: e.target.value})} 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-text"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text mb-1.5">{t('sftpPassword')}</label>
                                    <input 
                                        type="password" 
                                        value={sftpConfig.password} 
                                        onChange={e => setSftpConfig({...sftpConfig, password: e.target.value})} 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-text"
                                        placeholder={sftpConfig.password ? "••••••••" : ""}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RCON */}
                    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
                        <div className="bg-black/5 dark:bg-white/5 px-6 py-4 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-text flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${rconEnabled ? 'bg-orange-500' : 'bg-muted'}`}></span> {t('rconSection')}
                                </h2>
                                {/* Хелпер Кнопка */}
                                <button 
                                    onClick={() => setShowRconHelp(true)}
                                    className="text-xs text-primary hover:text-primary-hover hover:underline flex items-center gap-1 ml-2 font-medium"
                                >
                                    <HelpCircle size={14} /> {t('whereToFind')}
                                </button>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-xs font-bold uppercase text-muted">{t('enableRcon')}</span>
                                <input 
                                    type="checkbox" 
                                    checked={rconEnabled}
                                    onChange={e => setRconEnabled(e.target.checked)}
                                    className="accent-primary w-5 h-5 rounded border-gray-300" 
                                />
                            </label>
                        </div>

                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${rconEnabled ? 'max-h-96 opacity-100' : 'max-h-0 opacity-50'}`}>
                            <div className="p-6 space-y-5 border-t border-border/50">
                                <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={useSftpHost}
                                        onChange={e => setUseSftpHost(e.target.checked)}
                                        className="accent-primary w-4 h-4 rounded border-gray-300" 
                                    />
                                    <span className="text-sm text-text">{t('useSftpHost')}</span>
                                </label>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-text mb-1.5">RCON Host</label>
                                        <input 
                                            value={useSftpHost ? sftpConfig.host : sftpConfig.rcon_host} 
                                            onChange={e => !useSftpHost && setSftpConfig({...sftpConfig, rcon_host: e.target.value})} 
                                            disabled={useSftpHost}
                                            className={`w-full bg-background border border-border rounded-lg px-3 py-2.5 outline-none transition-all text-text ${useSftpHost ? 'opacity-50 cursor-not-allowed' : 'focus:border-primary'}`} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text mb-1.5">{t('rconPort')}</label>
                                        <input 
                                            type="number" 
                                            value={sftpConfig.rcon_port} 
                                            onChange={e => setSftpConfig({...sftpConfig, rcon_port: parseInt(e.target.value)})} 
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 focus:border-primary outline-none text-text"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text mb-1.5">RCON Password</label>
                                    <input 
                                        type="password" 
                                        value={sftpConfig.rcon_password} 
                                        onChange={e => setSftpConfig({...sftpConfig, rcon_password: e.target.value})} 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 focus:border-primary outline-none text-text"
                                        placeholder={sftpConfig.rcon_password ? "••••••••" : t('rconPasswordPlaceholder')}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SYNC SCOPE */}
                    <div className="bg-surface border border-border rounded-xl shadow-sm p-6">
                        <h3 className="font-bold text-text mb-4 text-sm uppercase tracking-wider text-muted">{t('whatToSync')}</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xs font-bold text-primary mb-3 uppercase">{t('contentFiles')}</h4>
                                <div className="space-y-2">
                                    {[{key: 'mods', label: t('modsFolder')}, {key: 'shaderpacks', label: t('shadersFolder')}, {key: 'resourcepacks', label: t('resourcesFolder')}].map(item => (
                                        <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                                            <input type="checkbox" checked={sftpConfig[`sync_${item.key}`]} onChange={e => setSftpConfig({...sftpConfig, [`sync_${item.key}`]: e.target.checked})} className="accent-primary w-4 h-4 rounded"/>
                                            <span className="text-sm text-text">{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-orange-500 mb-3 uppercase">{t('systemFiles')}</h4>
                                <div className="space-y-2">
                                    {[{key: 'config', label: t('configFolder')}, {key: 'scripts', label: t('scriptsFolder')}].map(item => (
                                        <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                                            <input type="checkbox" checked={sftpConfig[`sync_${item.key}`]} onChange={e => setSftpConfig({...sftpConfig, [`sync_${item.key}`]: e.target.checked})} className="accent-primary w-4 h-4 rounded"/>
                                            <span className="text-sm text-text">{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-border flex justify-end">
                             <button onClick={handleSave} disabled={loadingConfig} className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-black/80 dark:hover:bg-white/90 transition-all font-bold shadow-lg disabled:opacity-50">
                                <Save size={18}/> {t('saveSettings')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-5 flex flex-col gap-6 h-full min-h-[600px] sticky top-6">
                    <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
                        <h2 className="text-lg font-bold mb-2 text-text">{t('actions')}</h2>
                        <p className="text-sm text-muted mb-6 leading-relaxed">{t('syncDescription')}</p>
                        <button onClick={handleSyncClick} disabled={syncing || !sftpConfig.host} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98]">
                            {syncing ? (
                                <>
                                    <RefreshCw className="animate-spin" size={24}/>
                                    <span className="text-lg">{t('syncing')}</span>
                                    <div className="absolute bottom-0 left-0 h-1.5 bg-white/30 animate-[progress_2s_infinite_linear] w-full"></div>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-500"/>
                                    <span className="text-lg">{t('startSync')}</span>
                                </>
                            )}
                        </button>
                        <div className="mt-6 pt-6 border-t border-border">
                             <h4 className="text-xs font-bold text-muted mb-3 uppercase tracking-wider">{t('quickActions')}</h4>
                             <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setConfirmModal({isOpen: true, type: 'stop'})} disabled={!rconEnabled} className="py-3 px-4 border border-border rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center gap-2 text-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                     <Shield size={16} /> {t('sendStop')}
                                </button>
                                <button className="py-3 px-4 border border-border rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center gap-2 text-muted transition-all disabled:opacity-50" disabled>
                                     <Command size={16} /> Restart
                                </button>
                             </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-[#1e1e1e] rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col border border-border shadow-inner relative transition-colors text-gray-300">
                        <div className="flex items-center justify-between text-gray-500 mb-2 border-b border-gray-700 pb-2 uppercase tracking-wider font-bold select-none">
                            <div className="flex items-center gap-2"><Terminal size={14}/> {t('operationLog')}</div>
                            {syncing && <div className="flex items-center gap-2 text-green-400"><Activity size={14} className="animate-pulse"/><span className="text-[10px]">{t('live')}</span></div>}
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {syncLogs ? <pre className="whitespace-pre-wrap font-mono leading-relaxed">{syncLogs}{syncing && <span className="animate-pulse inline-block ml-1 w-2 h-4 bg-primary align-middle"></span>}</pre> : <div className="text-gray-600 italic mt-10 text-center flex flex-col items-center gap-2"><Terminal size={32} className="opacity-20"/>{t('waitingForStart')}</div>}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}