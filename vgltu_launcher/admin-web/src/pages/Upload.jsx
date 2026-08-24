import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, ArrowLeft, CheckCircle, AlertTriangle, Loader2, 
  Folder, Box, Cpu, FileCode, ChevronDown, ChevronUp, 
  HelpCircle, X, BookOpen 
} from 'lucide-react';
import api from '../lib/api';
import { useLanguage } from '../lib/useContexts';

export default function UploadPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const dropRef = useRef(null);
  
  // State
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null); 
  const [msg, setMsg] = useState("");
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [progress, setProgress] = useState(0); 
  
  // UX State
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [showFaqModal, setShowFaqModal] = useState(false); // <--- New State for Modal

  const [formData, setFormData] = useState({
    title: '',
    mc_version: '1.12.2',
    loader_type: 'forge'
  });

  useEffect(() => {
    fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
      .then(res => res.json())
      .then(data => {
        const releases = data.versions.filter(v => v.type === 'release');
        setVersions(releases);
      })
      .catch(err => console.error("Failed to fetch MC versions", err))
      .finally(() => setLoadingVersions(false));
  }, []);

  const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragging(true);
      }
  };

  const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  };

  const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
          const droppedFile = files[0];
          if (droppedFile.name.endsWith('.zip') || droppedFile.name.endsWith('.rar')) {
              setFile(droppedFile);
              setStatus(null);
          } else {
              setMsg("Only .zip and .rar files are allowed");
              setStatus('error');
          }
      }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !formData.title.trim()) return;

    setStatus('uploading');
    setMsg(t('uploading'));
    setProgress(0);

    const data = new FormData();
    data.append('file', file);
    data.append('title', formData.title);
    data.append('mc_version', formData.mc_version);
    data.append('loader_type', formData.loader_type);

    try {
      const res = await api.post('/admin/upload-zip', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
        }
      });
      setStatus('success');
      setMsg(`${t('uploadSuccess')}\n${t('newFiles')}: ${res.data.stats.new_files_uploaded}`);
      
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMsg(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted hover:text-text mb-6 transition-colors font-medium">
        <ArrowLeft size={18} /> {t('cancel')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* FORM (3/5) */}
        <div className="lg:col-span-3 space-y-6">
            <div className="bg-surface border border-border p-8 rounded-xl shadow-lg relative overflow-hidden">
                
                {status === 'uploading' && (
                    <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300 z-50" style={{ width: `${progress}%` }}></div>
                )}

                <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-text">
                    <UploadCloud className="text-primary" /> {t('uploadTitle')}
                </h1>

                <form onSubmit={handleUpload} className="space-y-6">
                    {/* TITLE */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-1.5 uppercase tracking-wide">{t('instanceTitle')}</label>
                        <input 
                            required
                            placeholder="My HiTech Server"
                            className="w-full bg-background border border-border rounded-lg p-3 focus:border-primary outline-none transition-colors text-text placeholder:text-muted/30"
                            value={formData.title}
                            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        />
                    </div>

                    {/* CORE SETTINGS */}
                    <div>
                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
                            {t('coreSettings')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text mb-1.5 flex items-center gap-2">
                                    <Box size={14} className="text-muted" /> {t('mcVersion')}
                                </label>
                                <div className="relative">
                                    <select 
                                        required
                                        className="w-full bg-background border border-border rounded-lg p-3 focus:border-primary outline-none transition-colors text-text appearance-none cursor-pointer"
                                        value={formData.mc_version}
                                        onChange={e => setFormData({...formData, mc_version: e.target.value})}
                                        disabled={loadingVersions}
                                    >
                                        {loadingVersions ? (
                                            <option>{t('loading')}</option>
                                        ) : (
                                            versions.map(v => <option key={v.id} value={v.id}>{v.id}</option>)
                                        )}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text mb-1.5 flex items-center gap-2">
                                    <Cpu size={14} className="text-muted" /> {t('loaderType')}
                                </label>
                                <div className="relative">
                                    <select 
                                        required
                                        className="w-full bg-background border border-border rounded-lg p-3 focus:border-primary outline-none transition-colors text-text appearance-none cursor-pointer"
                                        value={formData.loader_type}
                                        onChange={e => setFormData({...formData, loader_type: e.target.value})}
                                    >
                                        <option value="forge">Forge</option>
                                        <option value="fabric">Fabric</option>
                                        <option value="neoforge">NeoForge</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DROPZONE */}
                    <div 
                        ref={dropRef}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`
                            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 group relative
                            ${isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-black/5 dark:hover:bg-white/5'}
                            ${file ? 'border-green-500/50 bg-green-500/5' : ''}
                        `}
                    >
                        <input 
                            type="file" 
                            accept=".zip,.rar" 
                            onChange={e => {
                                if (e.target.files.length > 0) setFile(e.target.files[0]);
                            }}
                            id="zip-upload"
                            className="hidden"
                        />
                        <label htmlFor="zip-upload" className="cursor-pointer block w-full h-full">
                            {file ? (
                                <div className="text-green-600 dark:text-green-400 font-medium flex flex-col items-center gap-3 animate-in zoom-in duration-300">
                                    <div className="p-4 bg-green-500/10 rounded-full">
                                        <CheckCircle size={32} />
                                    </div>
                                    <div>
                                        <span className="text-lg font-bold block">{file.name}</span>
                                        <span className="text-sm opacity-70 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <span className="text-xs text-muted hover:text-red-500 transition-colors" onClick={(e) => {
                                        e.preventDefault();
                                        setFile(null);
                                    }}>
                                        {t('removeFile')}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-muted flex flex-col items-center gap-4 group-hover:text-text transition-colors">
                                    <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-primary text-white' : 'bg-black/5 dark:bg-white/5'}`}>
                                        <UploadCloud size={40} className={isDragging ? 'animate-bounce' : ''} />
                                    </div>
                                    <div>
                                        <span className="text-lg font-medium block mb-1">
                                            {isDragging ? t('dropHere') : t('uploadDesc')}
                                        </span>
                                        <span className="text-xs font-mono bg-black/5 dark:bg-white/10 px-2 py-1 rounded">Supported: .ZIP, .RAR</span>
                                    </div>
                                </div>
                            )}
                        </label>
                    </div>

                    {/* BUTTON */}
                    <button 
                        type="submit" 
                        disabled={status === 'uploading' || !file || !formData.title.trim()}
                        className={`
                            w-full py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 text-lg
                            ${status === 'uploading' 
                                ? 'bg-muted cursor-wait text-white' 
                                : (!file || !formData.title.trim()) 
                                    ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed' 
                                    : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                            }
                        `}
                    >
                        {status === 'uploading' ? (
                            <>
                                <Loader2 className="animate-spin" />
                                <span>{progress}%</span>
                            </>
                        ) : (
                            <span>{t('deploy')}</span>
                        )}
                    </button>
                </form>

                {/* STATUS MESSAGE */}
                {status && status !== 'uploading' && (
                    <div className={`mt-6 p-4 rounded-xl flex gap-3 animate-in slide-in-from-top-2 ${status === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                        {status === 'success' ? <CheckCircle className="shrink-0" size={24} /> : <AlertTriangle className="shrink-0" size={24} />}
                        <div className="whitespace-pre-wrap text-sm font-medium">{msg}</div>
                    </div>
                )}
            </div>
        </div>

        {/* GUIDE (2/5) */}
        <div className="lg:col-span-2">
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden sticky top-6">
                <button 
                    onClick={() => setShowGuide(!showGuide)}
                    className="w-full px-6 py-4 bg-black/5 dark:bg-white/5 border-b border-border flex items-center justify-between hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                    <h3 className="font-bold text-text flex items-center gap-2 text-sm uppercase tracking-wide">
                        <Folder size={18} className="text-primary"/> {t('zipStructureTitle')}
                    </h3>
                    {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showGuide && (
                    <div className="p-6 space-y-6 animate-in slide-in-from-top-2">
                        <p className="text-sm text-muted leading-relaxed">
                            {t('zipStructureDesc')}
                        </p>

                        <div className="space-y-3">
                            {/* mods/ */}
                            <div className="flex gap-3 group">
                                <div className="mt-1">
                                    <Folder className="text-green-500 group-hover:scale-110 transition-transform" size={20} />
                                </div>
                                <div>
                                    <div className="font-mono text-sm font-bold text-text group-hover:text-green-500 transition-colors">mods/</div>
                                    <div className="text-xs text-muted">{t('folderModsDesc')}</div>
                                    <div className="flex gap-1 mt-1">
                                        <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 rounded border border-green-500/20">Client</span>
                                        <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 rounded border border-green-500/20">Server</span>
                                    </div>
                                </div>
                            </div>

                            {/* client-mods/ */}
                            <div className="flex gap-3 group">
                                <div className="mt-1">
                                    <Folder className="text-blue-500 group-hover:scale-110 transition-transform" size={20} />
                                </div>
                                <div>
                                    <div className="font-mono text-sm font-bold text-text group-hover:text-blue-500 transition-colors">client-mods/</div>
                                    <div className="text-xs text-muted">{t('folderClientDesc')}</div>
                                    <div className="flex gap-1 mt-1">
                                        <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 rounded border border-blue-500/20">Client Only</span>
                                    </div>
                                </div>
                            </div>

                            {/* server-mods/ */}
                            <div className="flex gap-3 group">
                                <div className="mt-1">
                                    <Folder className="text-orange-500 group-hover:scale-110 transition-transform" size={20} />
                                </div>
                                <div>
                                    <div className="font-mono text-sm font-bold text-text group-hover:text-orange-500 transition-colors">server-mods/</div>
                                    <div className="text-xs text-muted">{t('folderServerDesc')}</div>
                                    <div className="flex gap-1 mt-1">
                                        <span className="text-[10px] bg-orange-500/10 text-orange-600 px-1.5 rounded border border-orange-500/20">Server Only</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* config/ */}
                            <div className="flex gap-3 group">
                                <div className="mt-1">
                                    <FileCode className="text-gray-500 group-hover:scale-110 transition-transform" size={20} />
                                </div>
                                <div>
                                    <div className="font-mono text-sm font-bold text-text group-hover:text-gray-500 transition-colors">config/</div>
                                    <div className="text-xs text-muted">{t('folderConfigDesc')}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg flex gap-3 text-xs text-yellow-800 dark:text-yellow-200">
                            <AlertTriangle className="shrink-0" size={16} />
                            <span>{t('warningMixed')}</span>
                        </div>

                        {/* NEW FAQ TRIGGER BUTTON */}
                        <button
                            type="button"
                            onClick={() => setShowFaqModal(true)}
                            className="w-full py-2 px-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <HelpCircle size={16} />
                            FAQ & Troubleshooting
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* NEW FAQ MODAL OVERLAY */}
      {showFaqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-surface border border-border w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-border flex justify-between items-center bg-background/50 rounded-t-2xl">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-text">
                          <BookOpen size={24} className="text-primary"/> 
                          FAQ & Best Practices
                      </h2>
                      <button 
                          onClick={() => setShowFaqModal(false)}
                          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-muted hover:text-text"
                      >
                          <X size={24} />
                      </button>
                  </div>

                  {/* Modal Content - Scrollable */}
                  <div className="p-6 overflow-y-auto space-y-6 text-text">
                      
                      {/* Section 1: Structure */}
                      <section>
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-primary">
                              <Folder size={18} /> 1. Структура Архива
                          </h3>
                          <p className="text-sm text-muted mb-2">Для корректной работы сервера и лаунчера разложите моды по следующим папкам:</p>
                          <div className="bg-black/5 dark:bg-white/5 p-4 rounded-lg font-mono text-sm space-y-2 border border-border">
                              <div className="flex gap-2"><span className="font-bold text-green-600">/mods/</span> <span className="text-muted opacity-80">— Универсальные (Thermal, JEI, Create). Устанавливаются ВЕЗДЕ.</span></div>
                              <div className="flex gap-2"><span className="font-bold text-blue-600">/client-mods/</span> <span className="text-muted opacity-80">— Только клиент (OptiFine, Sodium, Maps). На сервер НЕ попадут.</span></div>
                              <div className="flex gap-2"><span className="font-bold text-orange-600">/server-mods/</span> <span className="text-muted opacity-80">— Только сервер (Spark, Backup, AuthMe). Игрокам НЕ скачаются.</span></div>
                              <div className="flex gap-2"><span className="font-bold text-gray-600">/config/</span> <span className="text-muted opacity-80">— Конфиги. Обязательны для синхронизации ID блоков.</span></div>
                          </div>
                      </section>

                      <hr className="border-border" />

                      {/* Section 2: Troubleshooting */}
                      <section className="space-y-4">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-red-500">
                              <AlertTriangle size={18} /> Troubleshooting
                          </h3>
                          
                          <div className="space-y-3">
                              <div className="p-4 border border-border rounded-lg bg-red-500/5">
                                  <h4 className="font-bold text-sm mb-1 text-red-600 dark:text-red-400">🔥 Сервер падает при запуске?</h4>
                                  <p className="text-sm text-muted">
                                      Ошибка <code>java.lang.NoClassDefFoundError: net/minecraft/client/...</code>?<br/>
                                      Это значит, что в папке <code>mods/</code> (или <code>server-mods/</code>) лежит <strong>клиентский мод</strong> (например, OptiFine, Sodium, Iris). Переместите их в папку <code>client-mods/</code>.
                                  </p>
                              </div>

                              <div className="p-4 border border-border rounded-lg">
                                  <h4 className="font-bold text-sm mb-1 text-orange-600 dark:text-orange-400">⚠️ Игрок видит "Mod Mismatch"?</h4>
                                  <p className="text-sm text-muted">
                                      Версии модов на клиенте и сервере отличаются. Убедитесь, что вы загрузили 
                                      абсолютно одинаковые файлы .jar в папку <code>mods/</code>. 
                                  </p>
                              </div>
                          </div>
                      </section>

                      <div className="bg-blue-500/10 text-blue-700 dark:text-blue-300 p-4 rounded-lg text-sm border border-blue-500/20 flex gap-2">
                          <CheckCircle size={18} className="shrink-0 mt-0.5" />
                          <div>
                              <strong>Pro Tip:</strong> Соберите сборку локально. Запустите чистый сервер и клиент. 
                              Если всё работает локально — смело загружайте архив сюда.
                          </div>
                      </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-border bg-background/50 rounded-b-2xl flex justify-end">
                      <button 
                          onClick={() => setShowFaqModal(false)}
                          className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                      >
                          {t('close')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
