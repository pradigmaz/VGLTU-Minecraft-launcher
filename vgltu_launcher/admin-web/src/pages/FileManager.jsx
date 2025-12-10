import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Trash2, FileText, Upload, Search, File as FileIcon, 
  Loader2, Box, Cpu, Image, Scroll, FileCode, Archive, CheckSquare, Square,
  Monitor, Server as ServerIcon, Globe, MoreVertical
} from 'lucide-react'
import api from '../lib/api'
import ConfigEditorModal from '../components/ConfigEditorModal'
import { useLanguage } from '../lib/LanguageContext'

const CATEGORIES = [
  { id: 'all', label: 'categoryAll', icon: Archive },
  { id: 'mods', label: 'categoryMods', prefix: 'mods/', icon: Box },
  { id: 'config', label: 'categoryConfigs', prefix: 'config/', icon: FileCode },
  { id: 'shaderpacks', label: 'categoryShaders', prefix: 'shaderpacks/', icon: Cpu },
  { id: 'resourcepacks', label: 'categoryResources', prefix: 'resourcepacks/', icon: Image },
  { id: 'scripts', label: 'categoryScripts', prefix: 'scripts/', icon: Scroll },
];

// Иконки для сторон
const SIDE_ICONS = {
    'CLIENT': Monitor,
    'SERVER': ServerIcon,
    'BOTH': Globe
};
const SIDE_COLORS = {
    'CLIENT': 'text-blue-500',
    'SERVER': 'text-orange-500',
    'BOTH': 'text-green-500'
};

export default function FileManager() {
  const { id } = useParams()
  const { t } = useLanguage()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [activeCat, setActiveCat] = useState('all')
  const [selectedFiles, setSelectedFiles] = useState([])
  
  // Editor State
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  // Side Menu State (какой файл сейчас меняем)
  const [openSideMenu, setOpenSideMenu] = useState(null); // path string

  const fetchFiles = () => {
    setLoading(true)
    api.get(`/admin/instances/${id}/files`)
      .then(res => setFiles(res.data))
      .catch(err => console.error("Failed to load files", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFiles()
  }, [id])

  // --- Handlers ---

  const handleDelete = async (path) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      await api.delete(`/admin/instances/${id}/files`, { params: { path } })
      setFiles(prev => prev.filter(f => f.path !== path))
      setSelectedFiles(prev => prev.filter(p => p !== path))
    } catch (e) {
      alert(e.message)
    }
  }

  const handleChangeSide = async (path, newSide) => {
      try {
          // Оптимистичное обновление UI
          setFiles(prev => prev.map(f => f.path === path ? { ...f, side: newSide } : f));
          setOpenSideMenu(null);
          
          await api.patch(`/admin/instances/${id}/files/side`, { path, side: newSide });
      } catch (e) {
          alert("Failed to update side: " + e.message);
          fetchFiles(); // Rollback
      }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return
    if (!confirm(t('deleteSelectedConfirm').replace('{count}', selectedFiles.length))) return
    
    setLoading(true)
    let successCount = 0
    for (const path of selectedFiles) {
      try {
        await api.delete(`/admin/instances/${id}/files`, { params: { path } })
        successCount++
      } catch (e) { console.error(e) }
    }
    setSelectedFiles([])
    fetchFiles()
  }

  const toggleFileSelection = (path) => {
    setSelectedFiles(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
  }

  const toggleSelectAll = () => {
    selectedFiles.length === filteredFiles.length ? setSelectedFiles([]) : setSelectedFiles(filteredFiles.map(f => f.path))
  }

  const handleUpload = async (e) => {
    const fileList = Array.from(e.target.files)
    if (fileList.length === 0) return

    setUploading(true)
    let folder = 'mods/'
    const cat = CATEGORIES.find(c => c.id === activeCat);
    if (cat?.prefix) folder = cat.prefix;

    for (const file of fileList) {
        let targetFolder = folder
        if (activeCat === 'all') {
             // Auto-detect folder logic
             if (file.name.endsWith('.cfg')) targetFolder = 'config/'
             // ... other rules
        }
        const path = targetFolder + file.name
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', path)
        try { await api.post(`/admin/instances/${id}/files`, formData) } catch(e){}
    }
    setUploading(false)
    fetchFiles()
  }

  const getFilteredFiles = () => {
    let result = files;
    if (activeCat !== 'all') {
        const cat = CATEGORIES.find(c => c.id === activeCat);
        if (cat) result = result.filter(f => f.path.startsWith(cat.prefix));
    }
    if (search) {
        result = result.filter(f => f.path.toLowerCase().includes(search.toLowerCase()));
    }
    return result;
  };

  const filteredFiles = getFilteredFiles();
  const CurrentIcon = CATEGORIES.find(c => c.id === activeCat)?.icon || Box;

  return (
    <div className="flex flex-col h-full animate-in fade-in" onClick={() => setOpenSideMenu(null)}>
      <ConfigEditorModal 
        isOpen={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        instanceId={id} 
        filePath={selectedFile} 
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl overflow-x-auto no-scrollbar">
            {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCat === cat.id;
                const count = cat.id === 'all' ? files.length : files.filter(f => f.path.startsWith(cat.prefix || 'impossible')).length;
                return (
                    <button key={cat.id} onClick={() => setActiveCat(cat.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5'}`}>
                        <Icon size={16} />{t(cat.label)}
                        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'bg-black/10 dark:bg-white/10 text-muted'}`}>{count}</span>
                    </button>
                );
            })}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-surface border border-border rounded-lg py-2 pl-9 pr-4 text-sm focus:border-primary outline-none transition-colors"/>
            </div>
            {selectedFiles.length > 0 && (
              <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20">
                <Trash2 size={18} /><span className="font-medium text-sm hidden sm:inline">{t('deleteSelected')} ({selectedFiles.length})</span>
              </button>
            )}
            <label className={`bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-primary/20 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                <span className="font-medium text-sm hidden sm:inline">{t('uploadFile')}</span>
                <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
        </div>
      </div>

      {/* File List */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm min-h-[500px]">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-black/5 dark:bg-black/20 text-xs font-bold text-muted uppercase tracking-wider">
          <div className="col-span-1 flex items-center justify-center">
            <button onClick={toggleSelectAll} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors">
              {selectedFiles.length === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
            </button>
          </div>
          <div className="col-span-6">{t('fileNamePath')}</div>
          <div className="col-span-2 text-center">{t('side')}</div> {/* NEW COLUMN */}
          <div className="col-span-2 text-right">{t('size')}</div>
          <div className="col-span-1 text-right">{t('actions')}</div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1 pb-20"> {/* pb-20 чтобы меню не обрезалось */}
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted gap-3"><Loader2 className="animate-spin" size={32} /><span>{t('loadingFiles')}</span></div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted gap-4"><div className="p-4 bg-black/5 dark:bg-white/5 rounded-full"><CurrentIcon size={32} className="opacity-50" /></div><p>{t('emptyCategory')}</p></div>
          ) : (
            filteredFiles.map((file) => {
              const isSelected = selectedFiles.includes(file.path);
              const SideIcon = SIDE_ICONS[file.side || 'BOTH'];
              const sideColor = SIDE_COLORS[file.side || 'BOTH'];

              return (
                <div key={file.path} className={`grid grid-cols-12 gap-4 items-center p-3 rounded-lg group transition-colors text-sm hover:bg-black/5 dark:hover:bg-white/5 ${isSelected ? 'bg-primary/5 border border-primary/20' : ''}`}>
                  <div className="col-span-1 flex items-center justify-center">
                    <button onClick={() => toggleFileSelection(file.path)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors">
                      {isSelected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-muted" />}
                    </button>
                  </div>
                  
                  <div className="col-span-6 flex items-center gap-3 font-mono text-text truncate">
                    {file.is_config ? <FileText size={18} className="text-yellow-500" /> : file.path.endsWith('.jar') ? <Box size={18} className="text-blue-500" /> : <FileIcon size={18} className="text-muted" />}
                    <div className="flex flex-col truncate">
                        <span className="truncate font-medium">{file.filename}</span>
                        <span className="text-xs text-muted truncate opacity-70">{file.path}</span>
                    </div>
                  </div>
                  
                  {/* SIDE COLUMN */}
                  <div className="col-span-2 flex justify-center relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenSideMenu(openSideMenu === file.path ? null : file.path); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${sideColor}`}
                        title="Change Side"
                      >
                          <SideIcon size={14} />
                          <span className="text-xs font-bold">{file.side || 'BOTH'}</span>
                      </button>

                      {/* SIDE DROPDOWN */}
                      {openSideMenu === file.path && (
                          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-surface border border-border shadow-xl rounded-lg z-50 w-32 py-1 flex flex-col animate-in zoom-in-95 duration-100">
                              {Object.keys(SIDE_ICONS).map(sideKey => {
                                  const SIcon = SIDE_ICONS[sideKey];
                                  return (
                                      <button 
                                        key={sideKey}
                                        onClick={(e) => { e.stopPropagation(); handleChangeSide(file.path, sideKey); }}
                                        className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${file.side === sideKey ? 'text-primary font-bold' : 'text-text'}`}
                                      >
                                          <SIcon size={14} /> {sideKey}
                                      </button>
                                  )
                              })}
                          </div>
                      )}
                  </div>

                  <div className="col-span-2 text-right text-muted font-mono text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  
                  <div className="col-span-1 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.is_config && <button onClick={() => {setSelectedFile(file.path); setEditorOpen(true)}} className="p-2 hover:bg-blue-500/10 text-muted hover:text-blue-600 rounded-md transition-colors"><FileText size={16} /></button>}
                    <button onClick={() => handleDelete(file.path)} className="p-2 hover:bg-red-500/10 text-muted hover:text-red-600 rounded-md transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  )
}