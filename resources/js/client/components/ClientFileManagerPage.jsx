import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FolderTree, 
  Folder, 
  File, 
  FileCode, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Upload, 
  Edit3, 
  Check, 
  Sparkles,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

export default function ClientFileManagerPage({ showToast, initialPath = '' }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('file'); // 'file' | 'folder'

  const fetchFiles = async (path = currentPath) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/client/files?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const json = await res.json();
        setFiles(json.data || []);
        setCurrentPath(json.current_path || path);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(initialPath);
  }, [initialPath]);

  const handleOpenFolder = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
    fetchFiles(newPath);
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/');
    setCurrentPath(newPath);
    fetchFiles(newPath);
  };

  const handleOpenFile = async (file) => {
    setLoading(true);
    try {
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      const res = await fetch(`/api/client/files/read?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const json = await res.json();
        setEditingFile(filePath);
        setFileContent(json.content || '');
        setIsEditing(true);
      }
    } catch (e) {
      if (showToast) showToast('Failed to open file', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/client/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: editingFile,
          content: fileContent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    const itemPath = currentPath ? `${currentPath}/${newItemName}` : newItemName;
    try {
      const res = await fetch('/api/client/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: itemPath,
          content: newItemType === 'folder' ? '' : '<?php\n// New file\n',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setIsCreateOpen(false);
      setNewItemName('');
      fetchFiles(currentPath);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Isolated File Explorer</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Strictly secured and jailed to your user account root directory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsEditing(false)}
                variant="outline"
                className="border-zinc-800 text-xs h-10 px-3.5 rounded-xl text-zinc-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Back to Files</span>
              </Button>
              <Button
                onClick={handleSaveFile}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-emerald-600/20"
              >
                <Save className="w-4 h-4 mr-1.5" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setNewItemType('file');
                  setIsCreateOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-amber-600/20 gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New File</span>
              </Button>
              <Button
                onClick={() => fetchFiles()}
                variant="outline"
                size="sm"
                className="border-zinc-800 text-zinc-400 h-10 px-3 rounded-xl"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumb Path Bar */}
      {!isEditing && (
        <div className="flex items-center gap-1.5 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-400 overflow-x-auto">
          <button
            onClick={() => {
              setCurrentPath('');
              fetchFiles('');
            }}
            className="hover:text-amber-400 font-bold text-white flex items-center gap-1"
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>~ (Home)</span>
          </button>

          {breadcrumbs.map((b, idx) => {
            const sub = breadcrumbs.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                <button
                  onClick={() => {
                    setCurrentPath(sub);
                    fetchFiles(sub);
                  }}
                  className="hover:text-amber-400 text-zinc-300 font-semibold"
                >
                  {b}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Editor or Files Grid */}
      {isEditing ? (
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="text-white font-bold">Editing: <code>{editingFile}</code></span>
            <span className="text-zinc-500">Monaco IDE • UTF-8</span>
          </div>

          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
            <Editor
              height="500px"
              language="php"
              theme="vs-dark"
              value={fileContent}
              onChange={(val) => setFileContent(val || '')}
              options={{
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
              }}
            />
          </div>
        </Card>
      ) : (
        <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-semibold uppercase">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Last Modified</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {currentPath && (
                  <tr onClick={handleNavigateUp} className="hover:bg-zinc-800/40 transition cursor-pointer">
                    <td colSpan={4} className="py-3 px-4 text-amber-400 font-bold flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      <span>.. (Up one level)</span>
                    </td>
                  </tr>
                )}

                {files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500 text-xs">
                      Directory is empty.
                    </td>
                  </tr>
                ) : (
                  files.map((item) => (
                    <tr
                      key={item.name}
                      onClick={() => item.is_dir ? handleOpenFolder(item.name) : handleOpenFile(item)}
                      className="hover:bg-zinc-800/30 transition cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-medium flex items-center gap-2.5">
                        {item.is_dir ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <span className="text-white group-hover:text-amber-400 transition">{item.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {item.is_dir ? '-' : `${Math.max(1, Math.round(item.size / 1024))} KB`}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {item.mod_time}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!item.is_dir && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFile(item);
                            }}
                            size="sm"
                            variant="ghost"
                            className="text-zinc-400 hover:text-white h-7 px-2"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Create File */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-sm rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Create New File</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateItem} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">File Name</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. index.php or config.json"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 rounded-xl">
                Create File
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
