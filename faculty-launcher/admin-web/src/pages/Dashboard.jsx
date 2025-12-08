import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Box, FolderCog, Layers, Loader2 } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext'; // <--- Импорт
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
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Layers size={32} className="text-primary" />
          <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
        </div>
        
        <Link to="/upload" className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-primary/20">
          <Plus size={18} /> {t('newBuild')}
        </Link>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center p-12 text-muted border border-dashed border-border rounded-xl bg-surface/30 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} /> Loading...
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center p-12 text-muted border border-dashed border-border rounded-xl bg-surface/30">
            {t('noInstances')}
          </div>
        ) : (
          instances.map((inst) => (
            <div key={inst.id} className="bg-surface border border-border p-6 rounded-xl flex justify-between items-center hover:border-primary/50 transition-colors shadow-sm">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {inst.title}
                  <span className="text-xs bg-black/5 dark:bg-white/10 text-muted px-2 py-1 rounded border border-border font-mono">
                    {inst.mc_version}
                  </span>
                </h3>
                <p className="text-muted text-sm mt-1 font-mono text-xs opacity-70">ID: {inst.id}</p>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="text-sm text-muted">{t('files')}</div>
                  <div className="font-bold flex items-center gap-1 justify-end">
                    <Box size={14} /> {inst.files_count || '?'}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link 
                    to={`/instance/${inst.id}/files`}
                    className="p-2 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title={t('manageFiles')}
                  >
                    <FolderCog size={20} />
                  </Link>

                  <button 
                    onClick={() => handleDelete(inst.id)}
                    className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    title={t('deleteInstance')}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}