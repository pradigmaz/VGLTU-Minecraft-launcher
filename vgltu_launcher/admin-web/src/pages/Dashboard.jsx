import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Box, Settings, Layers, Loader2, Cpu, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import api from '../lib/api';

// Функция для русских склонений
const pluralize = (count, forms) => {
  let mod = count % 100;
  if (mod >= 11 && mod <= 19) return forms[2];
  mod = count % 10;
  if (mod === 1) return forms[0];
  if (mod >= 2 && mod <= 4) return forms[1];
  return forms[2];
};

// Компонент уведомления (Toast)
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
            {type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span className="font-medium">{message}</span>
        </div>
    );
};

export default function Dashboard() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();

  // Состояние удаления
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, title: '' });
  const [cleanupRemote, setCleanupRemote] = useState(false);
  
  // Визуализация процесса (idle, processing, success, error)
  const [deleteStatus, setDeleteStatus] = useState('idle'); 
  const [currentStep, setCurrentStep] = useState(''); // Text description
  const [toast, setToast] = useState(null);

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

  const openDeleteModal = (inst) => {
      setDeleteModal({ open: true, id: inst.id, title: inst.title });
      setCleanupRemote(false);
      setDeleteStatus('idle');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    
    setDeleteStatus('processing');
    
    try {
      // 1. Эмуляция этапа подключения (UX)
      if (cleanupRemote) {
          setCurrentStep(t('statusConnecting'));
          await new Promise(r => setTimeout(r, 600)); // Fake delay for UX
          
          setCurrentStep(t('statusCleaning'));
      } else {
          setCurrentStep(t('statusDatabase'));
      }

      // 2. Реальный запрос
      await api.delete(`/admin/instances/${deleteModal.id}?cleanup_remote=${cleanupRemote}`);
      
      // 3. Успех
      setCurrentStep(t('deleteSuccess'));
      setDeleteStatus('success');
      setToast({ message: t('deleteSuccess'), type: 'success' });
      
      // Закрытие через 1 сек
      setTimeout(() => {
          setDeleteModal({ open: false, id: null, title: '' });
          fetchInstances();
      }, 1000);

    } catch (e) {
      setDeleteStatus('idle'); // Вернуть форму
      setToast({ message: e.response?.data?.detail || e.message, type: 'error' });
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
            <p className="text-sm text-muted">{t('dashboardSubtitle')}</p>
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
                      <span className="text-text">{inst.files_count || 0} {lang === 'ru' ? pluralize(inst.files_count || 0, ['файл', 'файла', 'файлов']) : t('files')}</span>
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
                    onClick={() => openDeleteModal(inst)}
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

      {/* DELETE MODAL */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                
                {/* STATE: PROCESSING / SUCCESS */}
                {deleteStatus === 'processing' || deleteStatus === 'success' ? (
                   <div className="flex flex-col items-center justify-center py-8 text-center">
                       {deleteStatus === 'success' ? (
                           <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                               <CheckCircle2 size={32} />
                           </div>
                       ) : (
                           <div className="relative mb-4">
                               <Loader2 size={48} className="text-blue-500 animate-spin" />
                           </div>
                       )}
                       
                       <h3 className="text-xl font-bold text-text mb-2">{t('deleting')}</h3>
                       <p className="text-sm text-muted animate-pulse">{currentStep}</p>
                   </div>
                ) : (
                   /* STATE: CONFIRMATION FORM */
                   <>
                        <div className="flex items-center gap-4 mb-4 text-red-600 dark:text-red-500">
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">{t('deleteModalTitle')}</h3>
                                <p className="text-sm text-text opacity-80">{deleteModal.title}</p>
                            </div>
                        </div>
                        
                        <p className="text-muted mb-6 leading-relaxed">
                            {t('deleteConfirm')}
                        </p>

                        {/* Cleanup Checkbox */}
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={cleanupRemote}
                                    onChange={e => setCleanupRemote(e.target.checked)}
                                    className="mt-1 accent-red-600 w-5 h-5 rounded border-gray-300"
                                />
                                <div>
                                    <span className="font-bold text-text block group-hover:text-red-600 transition-colors">
                                        {t('deleteRemoteOption')}
                                    </span>
                                    <span className="text-xs text-red-600/80 dark:text-red-400 block mt-1">
                                        {t('deleteRemoteWarning')}
                                    </span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setDeleteModal({ open: false, id: null, title: '' })}
                                className="px-5 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-text font-medium transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                onClick={handleConfirmDelete}
                                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
                            >
                                <Trash2 size={18} />
                                {t('confirmDelete')}
                            </button>
                        </div>
                   </>
                )}
            </div>
        </div>
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}