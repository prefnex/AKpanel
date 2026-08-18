import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  File, 
  FileText, 
  FileCode, 
  Image, 
  Archive, 
  Database, 
  Upload, 
  Plus, 
  FolderPlus, 
  Trash2, 
  Edit3, 
  Download, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  Home, 
  Lock, 
  ShieldCheck, 
  Terminal, 
  GitBranch, 
  FileArchive, 
  Check, 
  X, 
  AlertCircle, 
  Eye, 
  Code, 
  Save, 
  Copy, 
  ExternalLink,
  Layers,
  HardDrive
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

export default function ClientFileManagerV2({ showToast, username }) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorLang, setEditorLang] = useState('plaintext');
  const [editorSaving, setEditorSaving] = useState(false);

  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  const [isChmodModalOpen, setIsChmodModalOpen] = useState(false);
  const [chmodTarget, setChmodTarget] = useState(null);
  const [chmodMode, setChmodMode] = useState('0644');

  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractTarget, setExtractTarget] = useState(null);

  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [gitRepoURL, setGitRepoURL] = useState('');
  const [gitCloning, setGitCloning] = useState(false);

  const token = localStorage.getItem('akpanel_client_token');

  const fetchFiles = async (path = currentPath) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/client/files?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) {
        setFiles(data.data || data.files || []);
        setCurrentPath(path);
      } else {
        showToast(data.message || 'Failed to list directory', 'error');
      }
    } catch (err) {
      showToast('Network error loading files', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles('/');
  }, []);

  const navigateTo = (path) => {
    fetchFiles(path);
  };

  const handleOpenFile = async (file) => {
    if (file.is_dir) {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      navigateTo(newPath);
      return;
    }

    // Determine language by extension
    const ext = file.extension ? file.extension.replace('.', '').toLowerCase() : '';
    const langMap = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'html': 'html', 'htm': 'html', 'css': 'css', 'scss': 'scss',
      'php': 'php', 'json': 'json', 'py': 'python', 'sh': 'shell',
      'sql': 'sql', 'md': 'markdown', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
      'txt': 'plaintext', 'htaccess': 'apacheconf', 'env': 'shell', 'conf': 'ini'
    };
    const lang = langMap[ext] || 'plaintext';
    setEditorLang(lang);

    const fullRelPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    try {
      const res = await fetch(`/api/client/files/read?path=${encodeURIComponent(fullRelPath)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) {
        setEditingFile({ ...file, fullPath: fullRelPath });
        setEditorContent(data.content || '');
        setIsEditorOpen(true);
      } else {
        showToast(data.message || 'Cannot open file', 'error');
      }
    } catch (err) {
      showToast('Failed to read file content', 'error');
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setEditorSaving(true);
    try {
      const res = await fetch('/api/client/files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: editingFile.fullPath,
          content: editorContent
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast('File saved successfully!', 'success');
      } else {
        showToast(data.message || 'Save failed', 'error');
      }
    } catch (err) {
      showToast('Failed to save file', 'error');
    } finally {
      setEditorSaving(false);
    }
  };

  const handleCreateFile = async (e) => {
    e.preventDefault();
    if (!newFileName) return;
    try {
      const res = await fetch('/api/client/files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: currentPath,
          name: newFileName
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast(`File '${newFileName}' created!`, 'success');
        setIsNewFileModalOpen(false);
        setNewFileName('');
        fetchFiles();
      } else {
        showToast(data.message || 'Failed to create file', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName) return;
    try {
      const res = await fetch('/api/client/files/mkdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: currentPath,
          name: newFolderName
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast(`Folder '${newFolderName}' created!`, 'success');
        setIsNewFolderModalOpen(false);
        setNewFolderName('');
        fetchFiles();
      } else {
        showToast(data.message || 'Failed to create folder', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = async (file) => {
    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    if (!confirm(`Are you sure you want to delete '${file.name}'?`)) return;

    try {
      const res = await fetch('/api/client/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: fullPath })
      });
      const data = await res.json();
      if (data.status) {
        showToast(`'${file.name}' deleted`, 'success');
        fetchFiles();
      } else {
        showToast(data.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameTarget || !renameNewName) return;
    const oldPath = currentPath === '/' ? `/${renameTarget.name}` : `${currentPath}/${renameTarget.name}`;

    try {
      const res = await fetch('/api/client/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          old_path: oldPath,
          new_name: renameNewName
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Item renamed successfully!', 'success');
        setIsRenameModalOpen(false);
        fetchFiles();
      } else {
        showToast(data.message || 'Rename failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleChmod = async (e) => {
    e.preventDefault();
    if (!chmodTarget || !chmodMode) return;
    const filePath = currentPath === '/' ? `/${chmodTarget.name}` : `${currentPath}/${chmodTarget.name}`;

    try {
      const res = await fetch('/api/client/files/chmod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: filePath,
          mode: chmodMode
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Permissions updated!', 'success');
        setIsChmodModalOpen(false);
        fetchFiles();
      } else {
        showToast(data.message || 'Chmod failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleExtract = async () => {
    if (!extractTarget) return;
    const archivePath = currentPath === '/' ? `/${extractTarget.name}` : `${currentPath}/${extractTarget.name}`;

    try {
      const res = await fetch('/api/client/files/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          archive_path: archivePath,
          dest_path: currentPath
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Archive extracted successfully!', 'success');
        setIsExtractModalOpen(false);
        fetchFiles();
      } else {
        showToast(data.message || 'Extraction failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleGitClone = async (e) => {
    e.preventDefault();
    if (!gitRepoURL) return;
    setGitCloning(true);
    try {
      const res = await fetch('/api/client/files/git-clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dest_path: currentPath,
          repo_url: gitRepoURL
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Git Repository cloned successfully!', 'success');
        setIsGitModalOpen(false);
        setGitRepoURL('');
        fetchFiles();
      } else {
        showToast(data.message || 'Git clone failed', 'error');
      }
    } catch (err) {
      showToast('Network error cloning repo', 'error');
    } finally {
      setGitCloning(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.is_dir) return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    const ext = file.extension ? file.extension.toLowerCase() : '';
    if (['.php', '.js', '.jsx', '.ts', '.tsx', '.py', '.sh', '.sql', '.html'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-emerald-400" />;
    }
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
      return <Image className="w-5 h-5 text-purple-400" />;
    }
    if (['.zip', '.tar', '.gz', '.tgz', '.rar'].includes(ext)) {
      return <Archive className="w-5 h-5 text-rose-400" />;
    }
    return <FileText className="w-5 h-5 text-zinc-400" />;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Breadcrumbs generator
  const pathParts = currentPath.split('/').filter(Boolean);

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Jail Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <HardDrive className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Jailed File Explorer v2</h2>
              <Badge variant="outline" className="bg-emerald-950/40 text-emerald-300 border-emerald-500/30 text-xs gap-1">
                <Lock className="w-3 h-3" /> Chrooted Jail: /home/{username || 'user'}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Manage web files, upload code, edit with Monaco, and extract archives strictly in your container sandbox.</p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <Button onClick={() => setIsNewFileModalOpen(true)} size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5 text-emerald-400" /> New File
          </Button>
          <Button onClick={() => setIsNewFolderModalOpen(true)} size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 gap-1.5 text-xs">
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> New Folder
          </Button>
          <Button onClick={() => setIsGitModalOpen(true)} size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 gap-1.5 text-xs">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" /> Git Clone
          </Button>
          <Button onClick={() => fetchFiles()} size="sm" variant="ghost" className="text-zinc-400 hover:text-white p-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Explorer Container */}
      <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Navigation Toolbar & Breadcrumbs */}
        <div className="p-4 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/40">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-1 overflow-x-auto text-sm text-zinc-300 py-1">
            <button 
              onClick={() => navigateTo('/')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-emerald-400 font-semibold transition"
            >
              <Home className="w-4 h-4" />
              <span>/home/{username || 'user'}</span>
            </button>
            {pathParts.map((part, idx) => {
              const fullStep = '/' + pathParts.slice(0, idx + 1).join('/');
              return (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  <button 
                    onClick={() => navigateTo(fullStep)}
                    className={`px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition truncate max-w-[160px] ${idx === pathParts.length - 1 ? 'text-white font-bold bg-zinc-800/80' : 'text-zinc-400'}`}
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 w-full md:w-64">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in this directory..." 
                className="pl-8 bg-zinc-900/80 border-zinc-700/80 text-xs h-9"
              />
            </div>
          </div>
        </div>

        {/* File List Table */}
        <div className="overflow-x-auto min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Scanning jailed filesystem...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <Folder className="w-12 h-12 text-zinc-700" />
              <p className="text-sm font-medium">This folder is empty</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setIsNewFileModalOpen(true)} className="bg-emerald-600 text-xs text-white">Create File</Button>
                <Button size="sm" onClick={() => setIsNewFolderModalOpen(true)} variant="outline" className="text-xs border-zinc-700 text-zinc-300">Create Folder</Button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800/80 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4">Last Modified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {/* Back button if in subfolder */}
                {currentPath !== '/' && (
                  <tr 
                    onClick={() => {
                      const parent = '/' + pathParts.slice(0, -1).join('/');
                      navigateTo(parent);
                    }}
                    className="hover:bg-zinc-900/40 cursor-pointer transition text-zinc-400"
                  >
                    <td className="py-2.5 px-4 flex items-center gap-2.5 font-medium">
                      <Folder className="w-4 h-4 text-amber-500/60" />
                      <span>.. (Up one level)</span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-600">-</td>
                    <td className="py-2.5 px-4 text-zinc-600">-</td>
                    <td className="py-2.5 px-4 text-zinc-600">-</td>
                    <td className="py-2.5 px-4 text-right text-zinc-600">-</td>
                  </tr>
                )}

                {filteredFiles.map((file, i) => {
                  const isArchive = ['.zip', '.tar', '.gz', '.tgz'].includes(file.extension);
                  return (
                    <tr 
                      key={i}
                      className="hover:bg-zinc-900/60 transition group cursor-pointer"
                      onDoubleClick={() => handleOpenFile(file)}
                    >
                      <td className="py-3 px-4 flex items-center gap-3">
                        {getFileIcon(file)}
                        <span 
                          onClick={() => handleOpenFile(file)} 
                          className={`font-medium ${file.is_dir ? 'text-amber-300 hover:underline' : 'text-zinc-200 hover:text-emerald-400'}`}
                        >
                          {file.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {file.is_dir ? 'Directory' : formatSize(file.size)}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-500">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setChmodTarget(file); setChmodMode(file.permissions || '0644'); setIsChmodModalOpen(true); }}
                          className="hover:text-emerald-400 underline decoration-zinc-700 hover:decoration-emerald-500"
                        >
                          {file.permissions || '0644'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {file.mod_time}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition">
                          {!file.is_dir && (
                            <Button 
                              onClick={(e) => { e.stopPropagation(); handleOpenFile(file); }}
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-950/40"
                              title="Edit with Monaco"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {isArchive && (
                            <Button 
                              onClick={(e) => { e.stopPropagation(); setExtractTarget(file); setIsExtractModalOpen(true); }}
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-amber-400 hover:bg-amber-950/40"
                              title="Extract Archive"
                            >
                              <FileArchive className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button 
                            onClick={(e) => { e.stopPropagation(); setRenameTarget(file); setRenameNewName(file.name); setIsRenameModalOpen(true); }}
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-zinc-400 hover:bg-zinc-800"
                            title="Rename"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-950/40"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full-Screen Monaco Code Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-5xl h-[85vh] bg-zinc-950 border-zinc-800 p-0 flex flex-col overflow-hidden text-zinc-200">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/90">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  {editingFile?.name}
                  <Badge variant="outline" className="text-[10px] uppercase font-mono border-zinc-700 text-zinc-400">
                    {editorLang}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">Jail: {editingFile?.fullPath}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                onClick={handleSaveFile} 
                disabled={editorSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 text-xs shadow-lg shadow-emerald-950"
              >
                <Save className="w-3.5 h-3.5" />
                {editorSaving ? 'Saving...' : 'Save File (Ctrl+S)'}
              </Button>
              <Button onClick={() => setIsEditorOpen(false)} variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-[#1e1e1e]">
            <Editor
              height="100%"
              language={editorLang}
              value={editorContent}
              onChange={(val) => setEditorContent(val || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* New File Modal */}
      <Dialog open={isNewFileModalOpen} onOpenChange={setIsNewFileModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileCode className="w-5 h-5 text-emerald-400" /> Create New File
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFile} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">File Name (e.g. index.php, style.css)</label>
              <Input 
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="script.js" 
                className="mt-1 bg-zinc-950 border-zinc-700"
                autoFocus
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono">Path: {currentPath}</p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewFileModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">Create File</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Folder Modal */}
      <Dialog open={isNewFolderModalOpen} onOpenChange={setIsNewFolderModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FolderPlus className="w-5 h-5 text-amber-400" /> Create New Directory
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Folder Name</label>
              <Input 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="assets" 
                className="mt-1 bg-zinc-950 border-zinc-700"
                autoFocus
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono">Location: {currentPath}</p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewFolderModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">Create Directory</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Edit3 className="w-5 h-5 text-cyan-400" /> Rename Item
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">New Name</label>
              <Input 
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                className="mt-1 bg-zinc-950 border-zinc-700"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsRenameModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Chmod Modal */}
      <Dialog open={isChmodModalOpen} onOpenChange={setIsChmodModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Change File Permissions (chmod)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChmod} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Octal Mode (e.g. 0755, 0644, 0777)</label>
              <Input 
                value={chmodMode}
                onChange={(e) => setChmodMode(e.target.value)}
                className="mt-1 bg-zinc-950 border-zinc-700 font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              {['0644', '0755', '0775', '0700'].map((p) => (
                <Button key={p} type="button" size="sm" variant="outline" onClick={() => setChmodMode(p)} className="border-zinc-700 text-xs font-mono">
                  {p}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsChmodModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">Apply Permissions</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Extract Archive Modal */}
      <Dialog open={isExtractModalOpen} onOpenChange={setIsExtractModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileArchive className="w-5 h-5 text-amber-400" /> Extract Compressed Archive
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-zinc-400">Extracting: <span className="text-white font-mono">{extractTarget?.name}</span></p>
            <p className="text-xs text-zinc-400">Destination: <span className="text-emerald-400 font-mono">{currentPath}</span></p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsExtractModalOpen(false)}>Cancel</Button>
              <Button onClick={handleExtract} className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">Extract Now</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Git Clone Modal */}
      <Dialog open={isGitModalOpen} onOpenChange={setIsGitModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <GitBranch className="w-5 h-5 text-cyan-400" /> Git Clone Repository
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGitClone} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Git Repository HTTPS URL</label>
              <Input 
                value={gitRepoURL}
                onChange={(e) => setGitRepoURL(e.target.value)}
                placeholder="https://github.com/user/my-app.git" 
                className="mt-1 bg-zinc-950 border-zinc-700"
                autoFocus
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono">Clone Destination: {currentPath}</p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsGitModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={gitCloning} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
                {gitCloning ? 'Cloning Repo...' : 'Clone Repository'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
