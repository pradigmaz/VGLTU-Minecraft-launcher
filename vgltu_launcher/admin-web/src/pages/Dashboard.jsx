import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Box, Settings, Layers, Loader2, Cpu } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import api from '../lib/api';

export default function Dashboard() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const fetchInstances = () => {
    setLoading(true);
    api.get('/admin/instances')
      .then(res => setInstances(res.data))
      .catch(err => console.error("Failed to load instances", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/admin/instances/${id}`);
      fetchInstances();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
            <Layers size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text">{t('dashboard')}</h1>
            <p className="text-sm text-muted">{t('dashboardSubtitle') || "Server & Instance Management"}</p>
          </div>
        </div>
        
        <Link to="/upload" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95">
          <Plus size={20} /> {t('newBuild')}
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1,2,3].map(i => (
             <div key={i} className="h-48 rounded-2xl bg-surface animate-pulse" />
           ))}
        </div>
      ) : instances.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed border-border rounded-3xl bg-surface flex flex-col items-center gap-4 text-muted">
          <Layers size={48} className="opacity-30" />
          <p className="text-lg font-medium">{t('noInstances')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((inst) => (
            <div key={inst.id} className="group relative bg-surface border border-border rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-500/30 overflow-hidden">
              
              {/* Фоновая иконка */}
              <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
                <Box size={140} className="text-text" />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-text truncate pr-4" title={inst.title}>
                      {inst.title}
                    </h3>
                    <span className="shrink-0 text-xs font-mono font-bold bg-black/5 dark:bg-white/10 text-muted px-2 py-1 rounded-md border border-border">
                        {inst.mc_version}
                    </span>
                </div>
                
                <p className="text-xs text-muted font-mono bg-black/5 dark:bg-black/20 inline-block px-2 py-1 rounded mb-6 w-fit border border-border">
                    {inst.id}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                  <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-border">
                      <Box size={16} className="text-blue-500" />
                      <span className="text-text">{inst.files_count || 0} {t('files') || 'Files'}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-border">
                      <Cpu size={16} className="text-purple-500" />
                      <span className="capitalize text-text">{inst.loader_type || 'Forge'}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-auto pt-4 border-t border-border">
                  <Link 
                    to={`/instance/${inst.id}/settings`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/5 dark:bg-white/5 hover:bg-blue-600 text-text hover:text-white rounded-xl transition-all font-medium text-sm"
                  >
                    <Settings size={16} /> {t('settings')}
                  </Link>

                  <button 
                    onClick={() => handleDelete(inst.id)}
                    className="p-2.5 text-muted hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-colors"
                    title={t('deleteInstance')}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}