import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, FileText, Upload, Search, File as FileIcon, Loader2 } from 'lucide-react'
import api from '../lib/api'
import ConfigEditorModal from '../components/ConfigEditorModal'
import { useLanguage } from '../lib/LanguageContext'

export default function FileManager() {
  const { id } = useParams()
  const { t } = useLanguage()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  
  // Editor State
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

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

  const handleDelete = async (path) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      await api.delete(`/admin/instances/${id}/files`, { params: { path } })
      setFiles(prev => prev.filter(f => f.path !== path))
    } catch (e) {
      alert(e.message)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    let folder = 'mods/'
    if (file.name.endsWith('.cfg') || file.name.endsWith('.json') || file.name.endsWith('.txt') || file.name.endsWith('.toml')) {
        folder = 'config/'
    }
    
    const path = prompt(`Target path for ${file.name}:`, folder + file.name)
    if (!path) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)

    try {
      await api.post(`/admin/instances/${id}/files`, formData)
      fetchFiles()
    } catch (e) {
      alert("Upload failed: " + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (path) => {
    setSelectedFile(path)
    setEditorOpen(true)
  }

  const filteredFiles = files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)]">
      <ConfigEditorModal 
        isOpen={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        instanceId={id} 
        filePath={selectedFile} 
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-muted hover:text-text dark:hover:text-white">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-text">
              {t('fileManager')}
              <span className="text-sm font-normal text-muted bg-black/5 dark:bg-white/10 px-2 py-1 rounded border border-border font-mono">
                {id}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className={`bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-primary/20 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            <span className="font-medium">{t('uploadFile')}</span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input 
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg py-3 pl-10 pr-4 outline-none focus:border-primary transition-colors text-sm text-text placeholder:text-muted"
        />
      </div>

      {/* Files Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        {/* Table Header - Адаптивный фон */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-gray-50 dark:bg-black/20 text-sm font-medium text-muted">
          <div className="col-span-8">Filename / Path</div>
          <div className="col-span-2 text-right">{t('size')}</div>
          <div className="col-span-2 text-right">{t('actions')}</div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1 max-h-[600px]">
          {loading ? (
            <div className="p-8 text-center text-muted flex flex-col items-center gap-2">
              <Loader2 className="animate-spin" size={24} /> Loading files...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-8 text-center text-muted">No files match your search.</div>
          ) : (
            filteredFiles.map((file) => (
              <div 
                key={file.path} 
                className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg group transition-colors text-sm
                           hover:bg-black/5 dark:hover:bg-white/5" /* Адаптивный ховер */
              >
                <div className="col-span-8 flex items-center gap-3 font-mono text-text truncate">
                  {file.is_config ? (
                    <FileText size={16} className="text-yellow-600 dark:text-yellow-500" />
                  ) : (
                    <FileIcon size={16} className="text-blue-600 dark:text-blue-500" />
                  )}
                  {/* Основной цвет текста теперь берется из переменной темы */}
                  <span title={file.path} className="opacity-90">{file.path}</span>
                </div>
                
                <div className="col-span-2 text-right text-muted font-mono text-xs">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
                
                <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.is_config && (
                    <button 
                      onClick={() => handleEdit(file.path)}
                      className="p-2 hover:bg-blue-500/10 text-muted hover:text-blue-600 dark:hover:text-blue-400 rounded-md transition-colors" 
                      title="Edit Config"
                    >
                      <FileText size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(file.path)}
                    className="p-2 hover:bg-red-500/10 text-muted hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors" 
                    title="Delete File"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}