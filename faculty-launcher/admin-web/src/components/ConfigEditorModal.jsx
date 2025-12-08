import { useState, useEffect } from 'react'
import { X, Save, Loader2, FileCode, FileText } from 'lucide-react'
import MDEditor, { commands } from '@uiw/react-md-editor'; // <--- Импортируем commands
import '@uiw/react-md-editor/markdown-editor.css'; 

import api from '../lib/api'
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/LanguageContext';

export default function ConfigEditorModal({ isOpen, onClose, instanceId, filePath }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { theme } = useTheme(); 
  const { t } = useLanguage();

  const isMarkdown = filePath?.endsWith('.md');
  const isJson = filePath?.endsWith('.json');

  useEffect(() => {
    if (isOpen && filePath) {
      setLoading(true)
      api.get(`/admin/instances/${instanceId}/config`, { params: { path: filePath } })
        .then(res => setContent(res.data))
        .catch(err => {
            console.error(err);
            setContent("");
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, instanceId, filePath])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/admin/instances/${instanceId}/config`, { content }, { params: { path: filePath } })
      onClose()
    } catch (err) {
      alert("Error saving: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* --- HEADER --- */}
        <div className="flex justify-between items-center p-4 border-b border-border bg-gray-50 dark:bg-black/20">
          <div className="flex items-center gap-3">
            {isMarkdown ? <FileText className="text-pink-500" size={20}/> : <FileCode className="text-blue-500" size={20}/>}
            <div>
              <h3 className="font-mono text-sm font-bold text-text break-all">{filePath}</h3>
              <span className="text-xs text-muted">
                {isMarkdown ? "Rich Text Editor" : isJson ? "JSON Mode" : "Plain Text Mode"}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors text-muted hover:text-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- EDITOR AREA --- */}
        <div className="flex-1 relative overflow-hidden bg-white dark:bg-[#0d1117]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-muted bg-surface">
              <Loader2 className="animate-spin text-primary" size={40} />
              <span>Loading content...</span>
            </div>
          ) : isMarkdown ? (
            /* MARKDOWN EDITOR (FULL FEATURES) */
            <div className="h-full w-full" data-color-mode={theme}>
              <MDEditor
                value={content}
                onChange={setContent}
                height="100%"
                preview="live"
                visibleDragbar={false}
                /* 🔥 РАСШИРЕННЫЙ НАБОР ИНСТРУМЕНТОВ 🔥 */
                commands={[
                    commands.bold, commands.italic, commands.strikethrough, commands.hr,
                    commands.divider,
                    commands.title, commands.title1, commands.title2, commands.title3, commands.title4,
                    commands.divider,
                    commands.link, commands.quote, commands.code, commands.codeBlock, commands.image,
                    commands.divider,
                    commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand, 
                    commands.divider,
                    commands.table, commands.help,
                ]}
                extraCommands={[
                    commands.codeEdit, commands.codeLive, commands.codePreview, commands.fullscreen
                ]}
                style={{ 
                    borderRadius: 0, 
                    border: 'none',
                    height: '100%',
                    backgroundColor: theme === 'dark' ? '#0d1117' : '#ffffff',
                    color: theme === 'dark' ? '#c9d1d9' : '#24292e'
                }}
              />
            </div>
          ) : (
            /* STANDARD CODE EDITOR */
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full h-full font-mono text-sm p-4 outline-none resize-none leading-relaxed transition-colors
                         bg-white text-gray-900 
                         dark:bg-[#0d1117] dark:text-gray-200"
              spellCheck="false"
              style={{ tabSize: 4 }}
            />
          )}
        </div>

        {/* --- FOOTER --- */}
        <div className="p-4 border-t border-border flex justify-between items-center bg-gray-50 dark:bg-black/20">
          <div className="text-xs text-muted hidden sm:block">
            {content.length} characters
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-sm text-muted hover:text-text transition-colors font-medium"
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || loading}
              className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}