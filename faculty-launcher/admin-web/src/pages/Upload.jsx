import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, ArrowLeft, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';

export default function UploadPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [msg, setMsg] = useState("");
  
  // Список версий Minecraft
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    mc_version: '1.12.2', // Дефолт
    loader_type: 'forge'
  });

  // Загружаем список версий с Mojang при старте
  useEffect(() => {
    fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
      .then(res => res.json())
      .then(data => {
        // Фильтруем только релизы (без снапшотов) для стабильности
        const releases = data.versions.filter(v => v.type === 'release');
        setVersions(releases);
        // Если текущей версии нет в списке (например при первом рендере), ставим самую новую
        if (releases.length > 0 && !formData.mc_version) {
            setFormData(prev => ({ ...prev, mc_version: releases[0].id }));
        }
      })
      .catch(err => console.error("Failed to fetch MC versions", err))
      .finally(() => setLoadingVersions(false));
  }, []);

  const handleTitleChange = (e) => {
    setFormData(prev => ({ ...prev, title: e.target.value }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !formData.title.trim()) return;

    setStatus('loading');
    setMsg("Uploading & Processing... Please wait.");

    const data = new FormData();
    data.append('file', file);
    data.append('title', formData.title);
    data.append('mc_version', formData.mc_version);
    data.append('loader_type', formData.loader_type);

    try {
      const res = await api.post('/admin/upload-zip', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStatus('success');
      setMsg(`Success!\nUploaded: ${res.data.stats.new_files_uploaded}\nDeduplicated: ${res.data.stats.files_deduplicated}`);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMsg(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted hover:text-text mb-6 transition-colors">
        <ArrowLeft size={18} /> Назад
      </button>

      <div className="bg-surface border border-border p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-text">
          <UploadCloud className="text-primary" /> {t('uploadTitle')}
        </h1>

        <form onSubmit={handleUpload} className="space-y-5">
          
          {/* TITLE */}
          <div>
            <label className="block text-sm text-muted mb-1">Title</label>
            <input 
              required
              placeholder="Название модпака"
              className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text"
              value={formData.title}
              onChange={handleTitleChange}
            />
          </div>

          {/* VERSION & LOADER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Minecraft Version</label>
              <div className="relative">
                <select 
                  required
                  className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text appearance-none cursor-pointer"
                  value={formData.mc_version}
                  onChange={e => setFormData({...formData, mc_version: e.target.value})}
                  disabled={loadingVersions}
                >
                  {loadingVersions ? (
                    <option>Loading versions...</option>
                  ) : (
                    versions.map(v => (
                      <option key={v.id} value={v.id}>{v.id}</option>
                    ))
                  )}
                </select>
                {/* Стрелочка для селекта (кастомная) */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Mod Loader</label>
              <div className="relative">
                <select 
                  required
                  className="w-full bg-background border border-border rounded-lg p-2.5 focus:border-primary outline-none transition-colors text-text appearance-none cursor-pointer"
                  value={formData.loader_type}
                  onChange={e => setFormData({...formData, loader_type: e.target.value})}
                >
                  <option value="forge">Forge</option>
                  <option value="fabric">Fabric</option>
                  <option value="neoforge">NeoForge</option>
                  <option value="quilt">Quilt</option>
                  <option value="vanilla">Vanilla (No Loader)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* DROPZONE */}
          <div className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-black/5 dark:hover:bg-white/5'}`}>
            <input 
              type="file" 
              accept=".zip,.rar" 
              onChange={e => setFile(e.target.files[0])}
              id="zip-upload"
              className="hidden"
            />
            <label htmlFor="zip-upload" className="cursor-pointer block w-full h-full">
              {file ? (
                <div className="text-primary font-medium flex flex-col items-center gap-2">
                    <CheckCircle size={32} />
                    <span className="text-lg">{file.name}</span>
                    <span className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ) : (
                <div className="text-muted flex flex-col items-center gap-3">
                    <UploadCloud size={40} className="text-border" />
                    <span className="text-lg font-medium">{t('uploadDesc')}</span>
                    <span className="text-xs opacity-50">Supported formats: .ZIP, .RAR</span>
                </div>
              )}
            </label>
          </div>

          <button 
            type="submit" 
            disabled={status === 'loading' || !file || !formData.title.trim()}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {status === 'loading' ? <Loader2 className="animate-spin" /> : null}
            {status === 'loading' ? 'Processing...' : t('deploy')}
          </button>
        </form>

        {status && status !== 'loading' && (
          <div className={`mt-6 p-4 rounded-xl flex gap-3 animate-in slide-in-from-top-2 ${status === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
            {status === 'success' ? <CheckCircle className="shrink-0" size={24} /> : <AlertTriangle className="shrink-0" size={24} />}
            <div className="whitespace-pre-wrap text-sm font-medium">{msg}</div>
          </div>
        )}
      </div>
    </div>
  );
}