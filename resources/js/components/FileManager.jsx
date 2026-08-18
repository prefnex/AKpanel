import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FolderTree, 
  Folder, 
  File, 
  FileCode, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  Wrench, 
  ChevronRight, 
  ArrowLeft, 
  Download, 
  Upload, 
  Archive, 
  Search, 
  Copy, 
  FolderArchive, 
  ExternalLink, 
  Shield, 
  Hash, 
  Globe, 
  HardDrive, 
  Eye, 
  Check, 
  Sparkles, 
  FileText, 
  FileImage, 
  Layers, 
  X, 
  LayoutGrid, 
  Table as TableIcon, 
  List, 
  ArrowUpDown, 
  Edit3, 
  Scissors, 
  Clipboard, 
  ChevronDown,
  FolderOpen,
  Server,
  Cpu,
  CornerDownRight,
  FolderInput,
  Maximize2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

// Recursive Tree Node Component for Left Sidebar
function TreeNode({ path, label, currentPath, onSelectPath }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [subdirs, setSubdirs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isSelected = currentPath === path;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (!loaded && !isExpanded) {
      try {
        const res = await fetch(`/api/files/subdirs?path=${encodeURIComponent(path)}`);
        if (res.ok) {
          const json = await res.json();
          setSubdirs(json.data || []);
          setLoaded(true);
        }
      } catch (err) {
        console.error(err);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const name = label || path.split('/').filter(Boolean).pop() || path;

  return (
    <div className="space-y-0.5 select-none font-mono">
      <div 
        onClick={() => onSelectPath(path)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer transition text-xs group ${
          isSelected 
            ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
        }`}
      >
        <button 
          onClick={handleToggle}
          className="p-0.5 rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-white transition"
        >
          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-white' : ''}`} />
        </button>

        {isExpanded ? (
          <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        )}
        <span className="truncate flex-1">{name}</span>
      </div>

      {isExpanded && subdirs.length > 0 && (
        <div className="pl-4 border-l border-zinc-800/80 space-y-0.5 animate-in fade-in duration-150">
          {subdirs.map(sub => (
            <TreeNode 
              key={sub} 
              path={sub} 
              currentPath={currentPath} 
              onSelectPath={onSelectPath} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileManager({ showToast }) {
  const [currentPath, setCurrentPath] = useState('/var/www/sites');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');

  // View Mode: 'table' | 'grid' | 'compact'
  const [viewMode, setViewMode] = useState('table');

  // Sorting: { field: 'name' | 'size' | 'mod_time' | 'extension', asc: boolean }
  const [sortConfig, setSortConfig] = useState({ field: 'name', asc: true });

  // Clipboard Buffer: { action: 'copy' | 'cut', sources: [] }
  const [clipboard, setClipboard] = useState(null);

  // Custom Context Menu State
  const [contextMenu, setContextMenu] = useState(null);

  // Left Tree Sidebar Toggle
  const [isTreeSidebarOpen, setIsTreeSidebarOpen] = useState(true);

  // Mini Path Explorer Picker Modal
  const [isPathPickerOpen, setIsPathPickerOpen] = useState(false);
  const [pickerTargetDir, setPickerTargetDir] = useState('/var/www/sites');
  const [pickerSources, setPickerSources] = useState([]);
  const [pickerMode, setPickerMode] = useState('copy');

  // Multi-Tab Monaco Editor State
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemIsDir, setNewItemIsDir] = useState(false);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameNewName, setRenameNewName] = useState('');

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveName, setArchiveName] = useState('archive.zip');
  const [archiveFormat, setArchiveFormat] = useState('zip');

  const [isRemoteDownloadOpen, setIsRemoteDownloadOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteFilename, setRemoteFilename] = useState('');

  const [isGrepOpen, setIsGrepOpen] = useState(false);
  const [grepQuery, setGrepQuery] = useState('');
  const [grepResults, setGrepResults] = useState([]);
  const [isGrepSearching, setIsGrepSearching] = useState(false);

  const [isChmodOpen, setIsChmodOpen] = useState(false);
  const [chmodTarget, setChmodTarget] = useState(null);
  const [chmodMode, setChmodMode] = useState('0755');
  const [chmodOwner, setChmodOwner] = useState('www-data');
  const [chmodGroup, setChmodGroup] = useState('www-data');
  const [chmodRecursive, setChmodRecursive] = useState(false);

  const [isChecksumOpen, setIsChecksumOpen] = useState(false);
  const [checksumData, setChecksumData] = useState(null);
  const [checksumFile, setChecksumFile] = useState(null);

  const [imagePreview, setImagePreview] = useState(null);
  const [dirSize, setDirSize] = useState(null);

  const fileInputRef = useRef(null);

  // Quick Bookmarks
  const bookmarks = [
    { label: 'Web Sites', path: '/var/www/sites' },
    { label: 'Nginx Conf', path: '/etc/nginx' },
    { label: 'Apache Conf', path: '/etc/apache2' },
    { label: 'PHP Conf', path: '/etc/php' },
    { label: 'System Logs', path: '/var/log' },
    { label: 'Root Home', path: '/root' },
  ];

  // Root tree folders for server
  const rootTreePaths = [
    { label: 'Web Sites', path: '/var/www' },
    { label: 'Nginx Conf', path: '/etc/nginx' },
    { label: 'Apache Conf', path: '/etc/apache2' },
    { label: 'PHP Conf', path: '/etc/php' },
    { label: 'System Logs', path: '/var/log' },
    { label: 'Root Home', path: '/root' },
    { label: 'User Home', path: '/home' },
    { label: 'Temporary Storage', path: '/tmp' },
  ];

  const fetchFiles = async (path = currentPath) => {
    setLoading(true);
    setSelectedItems([]);
    setContextMenu(null);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const json = await res.json();
        setFiles(json.data || []);
        setCurrentPath(json.current_path || path);
      } else {
        const json = await res.json();
        showToast(json.message || 'Cannot read directory', 'error');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleOpenFolder = (path) => {
    fetchFiles(path);
  };

  const handleGoUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const parent = '/' + parts.join('/');
      fetchFiles(parent || '/');
    }
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  // Double-Click Handler
  const handleItemDoubleClick = (item) => {
    if (item.is_dir) {
      handleOpenFolder(item.path);
    } else {
      handleOpenFile(item);
    }
  };

  // Open file in Monaco Multi-Tab Editor
  const handleOpenFile = async (file) => {
    if (file.is_image) {
      setImagePreview(file);
      return;
    }

    const existingIdx = openTabs.findIndex(t => t.path === file.path);
    if (existingIdx !== -1) {
      setActiveTabIdx(existingIdx);
      setIsEditorModalOpen(true);
      return;
    }

    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const json = await res.json();
        const newTab = {
          path: file.path,
          name: file.name,
          extension: file.extension,
          content: json.content || '',
          originalContent: json.content || '',
          isDirty: false,
        };
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabIdx(openTabs.length);
        setIsEditorModalOpen(true);
      }
    } catch (err) {
      showToast('Cannot read file contents', 'error');
    }
  };

  const handleSaveActiveTab = async () => {
    const tab = openTabs[activeTabIdx];
    if (!tab) return;

    try {
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: tab.path,
          content: tab.content,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);

      setOpenTabs(prev => prev.map((t, idx) => idx === activeTabIdx ? { ...t, originalContent: t.content, isDirty: false } : t));
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCloseTab = (idx, e) => {
    e.stopPropagation();
    setOpenTabs(prev => prev.filter((_, i) => i !== idx));
    if (activeTabIdx >= idx && activeTabIdx > 0) {
      setActiveTabIdx(activeTabIdx - 1);
    }
    if (openTabs.length <= 1) {
      setIsEditorModalOpen(false);
    }
  };

  // Copy / Cut to Clipboard
  const handleClipboardAction = (sources, action) => {
    setClipboard({ action, sources });
    showToast(`${sources.length} item(s) ${action === 'copy' ? 'copied' : 'cut'} to clipboard`);
  };

  // Paste from Clipboard
  const handlePasteClipboard = async () => {
    if (!clipboard || clipboard.sources.length === 0) return;
    const endpoint = clipboard.action === 'copy' ? '/api/files/copy' : '/api/files/move';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dest_dir: currentPath,
          sources: clipboard.sources,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      if (clipboard.action === 'cut') setClipboard(null);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenPathPicker = (sources, mode) => {
    setPickerSources(sources);
    setPickerMode(mode);
    setPickerTargetDir(currentPath);
    setIsPathPickerOpen(true);
  };

  const handleExecutePickerAction = async () => {
    if (pickerSources.length === 0) return;
    const endpoint = pickerMode === 'copy' ? '/api/files/copy' : '/api/files/move';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dest_dir: pickerTargetDir,
          sources: pickerSources,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsPathPickerOpen(false);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemName) return;
    const fullPath = `${currentPath}/${newItemName}`;
    try {
      const res = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fullPath,
          is_dir: newItemIsDir,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsCreateOpen(false);
      setNewItemName('');
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameTarget || !renameNewName) return;
    const newPath = `${currentPath}/${renameNewName}`;
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_path: renameTarget.path,
          new_path: newPath,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsRenameOpen(false);
      setRenameTarget(null);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Are you sure you want to delete '${item.name}'?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDuplicate = async (item) => {
    try {
      const res = await fetch('/api/files/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleArchive = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return;
    const destArchive = `${currentPath}/${archiveName}`;
    try {
      const res = await fetch('/api/files/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dest_archive: destArchive,
          format: archiveFormat,
          items: selectedItems,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsArchiveModalOpen(false);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExtract = async (file) => {
    try {
      const res = await fetch('/api/files/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archive_path: file.path,
          dest_dir: currentPath,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoteDownload = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/files/remote-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: remoteUrl,
          dest_dir: currentPath,
          filename: remoteFilename,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsRemoteDownloadOpen(false);
      setRemoteUrl('');
      setRemoteFilename('');
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGrepSearch = async (e) => {
    e.preventDefault();
    setIsGrepSearching(true);
    try {
      const res = await fetch('/api/files/grep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dir_path: currentPath,
          query: grepQuery,
        }),
      });
      const json = await res.json();
      setGrepResults(json.data || []);
    } catch (err) {
      showToast('Grep search failed', 'error');
    } finally {
      setIsGrepSearching(false);
    }
  };

  const handleShowChecksum = async (file) => {
    setChecksumFile(file);
    try {
      const res = await fetch(`/api/files/checksum?path=${encodeURIComponent(file.path)}`);
      const json = await res.json();
      if (res.ok) {
        setChecksumData(json.data);
        setIsChecksumOpen(true);
      }
    } catch (err) {
      showToast('Cannot calculate checksum', 'error');
    }
  };

  const handleCalculateDirSize = async () => {
    try {
      const res = await fetch(`/api/files/dirsize?path=${encodeURIComponent(currentPath)}`);
      const json = await res.json();
      if (res.ok) {
        setDirSize(json.size);
        showToast(`Folder size: ${json.size}`);
      }
    } catch (err) {
      showToast('Cannot calculate directory size', 'error');
    }
  };

  const handleFixPermissions = async () => {
    try {
      const res = await fetch('/api/files/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveChmod = async (e) => {
    e.preventDefault();
    if (!chmodTarget) return;
    try {
      const res = await fetch('/api/files/chmod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: chmodTarget.path,
          mode: chmodMode,
          owner: chmodOwner,
          group: chmodGroup,
          recursive: chmodRecursive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsChmodOpen(false);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);
    data.append('dest_dir', currentPath);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: data,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchFiles(currentPath);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === files.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(files.map(f => f.path));
    }
  };

  const toggleSelectItem = (path) => {
    setSelectedItems(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      asc: prev.field === field ? !prev.asc : true,
    }));
  };

  const mapMonacoLanguage = (ext) => {
    switch (ext) {
      case 'php': return 'php';
      case 'js': case 'jsx': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'yaml': case 'yml': return 'yaml';
      case 'sql': return 'sql';
      case 'py': return 'python';
      case 'go': return 'go';
      case 'sh': case 'bash': return 'shell';
      case 'md': return 'markdown';
      case 'xml': return 'xml';
      case 'conf': case 'ini': return 'ini';
      default: return 'plaintext';
    }
  };

  const processedFiles = [...files]
    .filter(f => f.name.toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;

      let valA = a[sortConfig.field];
      let valB = b[sortConfig.field];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortConfig.asc ? -1 : 1;
      if (valA > valB) return sortConfig.asc ? 1 : -1;
      return 0;
    });

  const activeTab = openTabs[activeTabIdx];

  return (
    <div className="space-y-6 select-none relative">
      
      {/* 1. Header & Super Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121215] border border-zinc-800/90 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">File Manager v1 (Modern Studio)</h2>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10 font-mono">
                VS Code Monaco Engine
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Multi-mode file explorer, VS Code editor, bookmarks, and folder permissions suite.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />

          <a 
            href="/filemanager/standalone" 
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 rounded-2xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Launch Fullscreen v2</span>
          </a>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 gap-1.5 hover:bg-zinc-800"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsRemoteDownloadOpen(true)}
            className="rounded-2xl border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 gap-1.5 hover:bg-zinc-800"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Remote Wget</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsGrepOpen(true)}
            className="rounded-2xl border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 gap-1.5 hover:bg-zinc-800"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span>Grep Code</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleFixPermissions}
            className="rounded-2xl border-zinc-800 bg-zinc-900 text-xs font-semibold text-emerald-400 gap-1.5 hover:bg-zinc-800"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Fix Web Perms</span>
          </Button>

          <Button 
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-2xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Item</span>
          </Button>
        </div>
      </div>

      {/* 2. Quick Bookmarks Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
        <span className="text-zinc-500 text-[11px] font-semibold uppercase mr-1 flex items-center gap-1">
          <HardDrive className="w-3 h-3" /> Bookmarks:
        </span>
        {bookmarks.map(bm => (
          <button
            key={bm.path}
            onClick={() => handleOpenFolder(bm.path)}
            className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold transition ${
              currentPath.startsWith(bm.path) 
                ? 'bg-zinc-800 text-white border border-zinc-700' 
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {bm.label}
          </button>
        ))}
      </div>

      {/* 3. Top Navigation Bar: Breadcrumbs & View Modes */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono text-zinc-300">
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setIsTreeSidebarOpen(!isTreeSidebarOpen)}
            title="Toggle Directory Tree Sidebar"
            className={`h-8 w-8 p-0 rounded-xl ${isTreeSidebarOpen ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
          >
            <FolderTree className="w-4 h-4" />
          </Button>

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleGoUp} 
            disabled={currentPath === '/'}
            className="h-8 w-8 p-0 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <span className="text-zinc-500 font-bold">Path:</span>
          <span className="font-bold text-white bg-zinc-900 px-3 py-1 rounded-xl border border-zinc-800 select-text">
            {currentPath}
          </span>
          {dirSize && (
            <Badge variant="secondary" className="text-[10px] bg-zinc-800 text-cyan-400 font-mono">
              {dirSize}
            </Badge>
          )}
        </div>

        {/* View Switchers, Clipboard & Search */}
        <div className="flex items-center gap-2">
          
          {clipboard && (
            <Button 
              size="sm" 
              onClick={handlePasteClipboard}
              className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold gap-1.5 animate-pulse"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste {clipboard.sources.length} Item(s)</span>
            </Button>
          )}

          <div className="relative w-44">
            <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-2.5" />
            <input 
              type="text" 
              placeholder="Filter files..." 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
            <button 
              onClick={() => setViewMode('table')} 
              title="Table View"
              className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('grid')} 
              title="Grid Cards View"
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('compact')} 
              title="Compact List View"
              className={`p-1.5 rounded-lg transition ${viewMode === 'compact' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button size="sm" variant="ghost" onClick={handleCalculateDirSize} title="Calculate Folder Size" className="h-8 px-2 rounded-xl text-zinc-400 gap-1 text-xs">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Size</span>
          </Button>

          <Button size="sm" variant="ghost" onClick={() => fetchFiles(currentPath)} className="h-8 px-2 rounded-xl text-zinc-400 gap-1 text-xs">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>

      {/* 4. Main Workspace with Recursive Directory Tree Sidebar */}
      <div className="flex gap-4 items-start min-h-[500px]">
        
        {/* Recursive Directory Tree Sidebar */}
        {isTreeSidebarOpen && (
          <aside className="w-60 bg-[#121215] border border-zinc-800/80 rounded-3xl p-3 shrink-0 shadow-sm space-y-2 animate-in fade-in duration-200 max-h-[600px] overflow-y-auto custom-scrollbar">
            <div className="px-2 py-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Server Path Tree</span>
            </div>
            
            <div className="space-y-1">
              {rootTreePaths.map(node => (
                <TreeNode 
                  key={node.path} 
                  path={node.path} 
                  label={node.label} 
                  currentPath={currentPath} 
                  onSelectPath={handleOpenFolder} 
                />
              ))}
            </div>
          </aside>
        )}

        {/* File Browser Canvas */}
        <div className="flex-1 min-w-0 space-y-4">
          
          {/* Bulk Selection Bar */}
          {selectedItems.length > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3 flex items-center justify-between animate-in fade-in text-xs">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                <span>{selectedItems.length} items selected</span>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => handleClipboardAction(selectedItems, 'copy')}
                  className="h-8 rounded-xl border-zinc-800 bg-zinc-900 text-xs font-semibold gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </Button>

                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => handleClipboardAction(selectedItems, 'cut')}
                  className="h-8 rounded-xl border-zinc-800 bg-zinc-900 text-xs font-semibold gap-1"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Cut</span>
                </Button>

                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenPathPicker(selectedItems, 'copy')}
                  className="h-8 rounded-xl border-zinc-800 bg-zinc-900 text-xs font-semibold gap-1"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  <span>Move / Copy to...</span>
                </Button>

                <Button 
                  size="sm"
                  onClick={() => setIsArchiveModalOpen(true)}
                  className="h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Compress Zip</span>
                </Button>
              </div>
            </div>
          )}

          {/* VIEW MODE 1: Sortable Detailed Table View */}
          {viewMode === 'table' && (
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/80 uppercase text-[10px] text-zinc-400 border-b border-zinc-800/80 font-semibold tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <Checkbox 
                          checked={selectedItems.length === files.length && files.length > 0} 
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">
                          <span>Name</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('size')}>
                        <div className="flex items-center gap-1">
                          <span>Size</span>
                          <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Permissions</th>
                      <th className="py-3 px-4">Owner:Group</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-sans">
                    {processedFiles.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-16 text-zinc-500">
                          <FolderTree className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                          <p className="font-semibold text-zinc-400">Empty directory</p>
                        </td>
                      </tr>
                    ) : (
                      processedFiles.map(item => (
                        <tr 
                          key={item.name} 
                          className={`hover:bg-zinc-900/50 transition cursor-pointer ${
                            selectedItems.includes(item.path) ? 'bg-zinc-900/60 ring-1 ring-zinc-700' : ''
                          }`}
                          onClick={() => toggleSelectItem(item.path)}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                          onContextMenu={(e) => handleContextMenu(e, item)}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedItems.includes(item.path)} 
                              onCheckedChange={() => toggleSelectItem(item.path)}
                            />
                          </td>

                          <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                            {item.is_dir ? (
                              <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                            ) : item.is_image ? (
                              <FileImage className="w-4 h-4 text-rose-400 shrink-0" />
                            ) : item.is_archive ? (
                              <FolderArchive className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                            )}
                            <span className="font-mono text-xs hover:text-blue-400 transition">{item.name}</span>
                          </td>

                          <td className="py-3 px-4 font-mono text-zinc-400">{item.human_size}</td>

                          <td className="py-3 px-4 font-mono">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setChmodTarget(item);
                                setChmodMode(item.octal_perm || '0755');
                                setChmodOwner(item.owner || 'www-data');
                                setChmodGroup(item.group || 'www-data');
                                setIsChmodOpen(true);
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 text-[11px]"
                            >
                              {item.permissions} ({item.octal_perm})
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-zinc-400">
                            {item.owner}:{item.group}
                          </td>

                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              
                              {item.is_archive && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleExtract(item)}
                                  title="Extract Archive"
                                  className="h-7 px-2 rounded-xl text-[11px] border-zinc-800 bg-zinc-900 text-amber-400"
                                >
                                  Extract
                                </Button>
                              )}

                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => {
                                  setRenameTarget(item);
                                  setRenameNewName(item.name);
                                  setIsRenameOpen(true);
                                }}
                                title="Rename"
                                className="h-7 w-7 p-0 rounded-xl text-zinc-400 hover:text-white"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>

                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleDuplicate(item)}
                                title="Duplicate / Clone"
                                className="h-7 w-7 p-0 rounded-xl text-zinc-400 hover:text-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>

                              <a 
                                href={`/api/files/download?path=${encodeURIComponent(item.path)}`}
                                download
                                className="h-7 w-7 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>

                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => handleDeleteItem(item)}
                                className="h-7 w-7 p-0 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* VIEW MODE 2: Large Cards Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {processedFiles.map(item => (
                <Card
                  key={item.name}
                  onClick={() => toggleSelectItem(item.path)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  className={`p-4 rounded-3xl bg-[#121215] border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center relative ${
                    selectedItems.includes(item.path) 
                      ? 'border-blue-500/80 bg-blue-950/10 ring-2 ring-blue-500/30' 
                      : 'border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mb-2">
                    {item.is_dir ? (
                      <Folder className="w-7 h-7 text-blue-400" />
                    ) : item.is_image ? (
                      <FileImage className="w-7 h-7 text-rose-400" />
                    ) : item.is_archive ? (
                      <FolderArchive className="w-7 h-7 text-amber-400" />
                    ) : (
                      <FileCode className="w-7 h-7 text-cyan-400" />
                    )}
                  </div>
                  <span className="font-mono text-xs font-semibold text-white truncate w-full" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{item.human_size}</span>
                </Card>
              ))}
            </div>
          )}

          {/* VIEW MODE 3: Compact List View */}
          {viewMode === 'compact' && (
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-3 shadow-sm divide-y divide-zinc-800/50">
              {processedFiles.map(item => (
                <div
                  key={item.name}
                  onClick={() => toggleSelectItem(item.path)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900/60 cursor-pointer text-xs font-mono transition"
                >
                  <div className="flex items-center gap-2 text-white">
                    {item.is_dir ? <Folder className="w-4 h-4 text-blue-400" /> : <FileCode className="w-4 h-4 text-zinc-400" />}
                    <span>{item.name}</span>
                  </div>
                  <span className="text-zinc-500 text-[11px]">{item.human_size}</span>
                </div>
              ))}
            </Card>
          )}

        </div>
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl p-1.5 w-56 text-xs text-zinc-200 font-sans space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 340), left: Math.min(contextMenu.x, window.innerWidth - 240) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider truncate border-b border-zinc-800/80 pb-1 mb-1">
            {contextMenu.item.name}
          </div>

          {!contextMenu.item.is_dir && (
            <button 
              onClick={() => { handleOpenFile(contextMenu.item); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Edit in VS Code</span>
            </button>
          )}

          {contextMenu.item.is_dir && (
            <button 
              onClick={() => { handleOpenFolder(contextMenu.item.path); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Open Folder</span>
            </button>
          )}

          <button 
            onClick={() => {
              handleClipboardAction([contextMenu.item.path], 'copy');
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span>Copy</span>
          </button>

          <button 
            onClick={() => {
              handleClipboardAction([contextMenu.item.path], 'cut');
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <Scissors className="w-3.5 h-3.5 text-zinc-400" />
            <span>Cut</span>
          </button>

          <button 
            onClick={() => {
              handleOpenPathPicker([contextMenu.item.path], 'copy');
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <FolderInput className="w-3.5 h-3.5 text-cyan-400" />
            <span>Move / Copy to...</span>
          </button>

          {contextMenu.item.is_archive && (
            <button 
              onClick={() => { handleExtract(contextMenu.item); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 text-amber-400 transition"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Extract Archive</span>
            </button>
          )}

          <button 
            onClick={() => {
              setRenameTarget(contextMenu.item);
              setRenameNewName(contextMenu.item.name);
              setIsRenameOpen(true);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Rename</span>
          </button>

          <button 
            onClick={() => { handleDuplicate(contextMenu.item); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span>Duplicate</span>
          </button>

          <button 
            onClick={() => {
              setChmodTarget(contextMenu.item);
              setChmodMode(contextMenu.item.octal_perm || '0755');
              setChmodOwner(contextMenu.item.owner || 'www-data');
              setChmodGroup(contextMenu.item.group || 'www-data');
              setIsChmodOpen(true);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Permissions</span>
          </button>

          {!contextMenu.item.is_dir && (
            <button 
              onClick={() => { handleShowChecksum(contextMenu.item); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
            >
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              <span>Checksum</span>
            </button>
          )}

          <a 
            href={`/api/files/download?path=${encodeURIComponent(contextMenu.item.path)}`}
            download
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Download</span>
          </a>

          <div className="border-t border-zinc-800/80 my-1" />

          <button 
            onClick={() => { handleDeleteItem(contextMenu.item); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-950/40 text-rose-400 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Mini Path Picker Modal */}
      <Dialog open={isPathPickerOpen} onOpenChange={setIsPathPickerOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FolderInput className="w-4 h-4 text-cyan-400" />
              <span>Select Destination Folder</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-3">
            <div className="p-2.5 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs font-mono text-cyan-400">
              Target: {pickerTargetDir}
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-2xl p-2 space-y-1">
              {rootTreePaths.map(node => (
                <TreeNode 
                  key={node.path} 
                  path={node.path} 
                  label={node.label} 
                  currentPath={pickerTargetDir} 
                  onSelectPath={setPickerTargetDir} 
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsPathPickerOpen(false)} className="rounded-xl border-zinc-800 text-xs">
              Cancel
            </Button>
            <Button 
              onClick={handleExecutePickerAction} 
              className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
            >
              {pickerMode === 'copy' ? 'Copy Here' : 'Move Here'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Monaco Multi-Tab Editor Modal */}
      {isEditorModalOpen && openTabs.length > 0 && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121215] rounded-3xl max-w-6xl w-full p-5 border border-zinc-800 shadow-2xl relative flex flex-col h-[90vh]">
            
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 mr-4">
                {openTabs.map((tab, idx) => (
                  <div 
                    key={tab.path}
                    onClick={() => setActiveTabIdx(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono cursor-pointer transition ${
                      activeTabIdx === idx 
                        ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
                        : 'bg-zinc-900/70 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>{tab.name}</span>
                    {tab.isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    <button onClick={(e) => handleCloseTab(idx, e)} className="hover:text-rose-400 ml-1">✕</button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm"
                  onClick={handleSaveActiveTab}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save File (Ctrl+S)</span>
                </Button>

                <Button size="sm" variant="ghost" onClick={() => setIsEditorModalOpen(false)} className="rounded-xl">
                  ✕
                </Button>
              </div>
            </div>

            <div className="flex-1 mt-3 rounded-2xl overflow-hidden border border-zinc-800">
              {activeTab && (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={mapMonacoLanguage(activeTab.extension)}
                  value={activeTab.content}
                  onChange={(val) => {
                    setOpenTabs(prev => prev.map((t, i) => i === activeTabIdx ? { ...t, content: val || '', isDirty: (val !== t.originalContent) } : t));
                  }}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    tabSize: 4,
                  }}
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-3 text-[11px] text-zinc-500 font-mono">
              <span>Path: {activeTab?.path}</span>
              <span>Language: {mapMonacoLanguage(activeTab?.extension).toUpperCase()} • Auto-Backup .bak enabled</span>
            </div>

          </div>
        </div>
      )}

      {/* Rename Modal */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Rename Item</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRenameSubmit} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">New Name</label>
              <Input 
                type="text" 
                required 
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
                Rename
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Modal */}
      {imagePreview && (
        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <FileImage className="w-4 h-4 text-rose-400" />
                <span>{imagePreview.name}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex items-center justify-center bg-black/60 rounded-2xl p-4 border border-zinc-800 min-h-64">
              <img 
                src={`/api/files/download?path=${encodeURIComponent(imagePreview.path)}`} 
                alt={imagePreview.name} 
                className="max-h-96 max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-zinc-400 mt-2">
              <span>Size: {imagePreview.human_size}</span>
              <span>Permissions: {imagePreview.permissions}</span>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Grep Code Search Modal */}
      <Dialog open={isGrepOpen} onOpenChange={setIsGrepOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-amber-400" />
              <span>Grep Code Search (Folder Wide)</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleGrepSearch} className="flex gap-2 mt-3">
            <Input 
              type="text" 
              required
              placeholder="Search code strings..." 
              value={grepQuery}
              onChange={(e) => setGrepQuery(e.target.value)}
              className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
            />
            <Button type="submit" disabled={isGrepSearching} className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
              {isGrepSearching ? 'Searching...' : 'Search'}
            </Button>
          </form>

          <div className="mt-4 max-h-72 overflow-y-auto custom-scrollbar space-y-2">
            {grepResults.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No occurrences found.</p>
            ) : (
              grepResults.map((r, i) => (
                <div 
                  key={i} 
                  onClick={() => handleOpenFile({ path: r.file_path, name: r.file_name, extension: r.file_name.split('.').pop() })}
                  className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs font-mono transition"
                >
                  <div className="flex justify-between text-indigo-400 font-bold">
                    <span>{r.file_name}</span>
                    <span className="text-zinc-500">Line {r.line_number}</span>
                  </div>
                  <pre className="mt-1 text-zinc-300 text-[11px] whitespace-pre-wrap">{r.snippet}</pre>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checksum / Hash Modal */}
      {isChecksumOpen && checksumData && (
        <Dialog open={isChecksumOpen} onOpenChange={setIsChecksumOpen}>
          <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-cyan-400" />
                <span>File Integrity Hashes ({checksumFile?.name})</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 mt-3 text-xs font-mono">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">MD5 Checksum:</span>
                <span className="text-cyan-400 select-all break-all">{checksumData.md5}</span>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">SHA-256 Checksum:</span>
                <span className="text-emerald-400 select-all break-all">{checksumData.sha256}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Chmod / Permissions Modal */}
      <Dialog open={isChmodOpen} onOpenChange={setIsChmodOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Permissions & Ownership</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {chmodTarget?.path}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveChmod} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Octal Mode (e.g. 0755, 0644)</label>
              <Input 
                value={chmodMode}
                onChange={(e) => setChmodMode(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">User Owner</label>
                <Input 
                  value={chmodOwner}
                  onChange={(e) => setChmodOwner(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Group Owner</label>
                <Input 
                  value={chmodGroup}
                  onChange={(e) => setChmodGroup(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white"
                />
              </div>
            </div>

            {chmodTarget?.is_dir && (
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                <Checkbox 
                  checked={chmodRecursive}
                  onCheckedChange={setChmodRecursive}
                />
                <span>Apply recursively to all children</span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsChmodOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
                Apply Permissions
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remote Downloader (Wget) Modal */}
      <Dialog open={isRemoteDownloadOpen} onOpenChange={setIsRemoteDownloadOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <span>Remote URL Downloader (Wget)</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRemoteDownload} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Remote File URL</label>
              <Input 
                type="url" 
                required
                placeholder="https://wordpress.org/latest.zip"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Custom Filename (Optional)</label>
              <Input 
                type="text" 
                placeholder="wordpress.zip"
                value={remoteFilename}
                onChange={(e) => setRemoteFilename(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsRemoteDownloadOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs">
                Download Now
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create File/Folder Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Create {newItemIsDir ? 'Directory' : 'File'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateItem} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Name</label>
              <Input 
                type="text" 
                required 
                placeholder={newItemIsDir ? 'my_folder' : 'index.php'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Zip Archive Modal */}
      <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-indigo-400" />
              <span>Compress {selectedItems.length} Selected Items</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleArchive} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Archive Name</label>
              <Input 
                type="text" 
                required 
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsArchiveModalOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs">
                Compress Now
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
