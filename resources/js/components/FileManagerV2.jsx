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
  Maximize2,
  Minimize2,
  FilePlus,
  FolderPlus,
  CheckSquare,
  Square,
  RefreshCw,
  Home,
  SlidersHorizontal,
  Split,
  Laptop
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

// Recursive Server Root Tree Node
function RootTreeNode({ path, label, currentPath, onSelectPath, apiBase = '/api/files' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [subdirs, setSubdirs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isSelected = currentPath === path;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (!loaded && !isExpanded) {
      try {
        const res = await fetch(`${apiBase}/subdirs?path=${encodeURIComponent(path)}`);
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

  const name = label || path.split('/').filter(Boolean).pop() || '/';

  return (
    <div className="space-y-0.5 select-none font-mono">
      <div
        onClick={() => onSelectPath(path)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition text-xs group ${isSelected
          ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
      >
        <button
          onClick={handleToggle}
          className="w-4 h-4 rounded flex items-center justify-center hover:bg-zinc-700/60 text-zinc-500 hover:text-white transition"
        >
          <span className="font-bold text-[11px] leading-none">
            {isExpanded ? '−' : '+'}
          </span>
        </button>

        {isExpanded ? (
          <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}
        <span className="truncate flex-1 text-[11px] tracking-tight">{name}</span>
      </div>

      {isExpanded && subdirs.length > 0 && (
        <div className="pl-3.5 border-l border-zinc-800/80 space-y-0.5 animate-in fade-in duration-100">
          {subdirs.map(sub => (
            <RootTreeNode
              key={sub}
              path={sub}
              currentPath={currentPath}
              onSelectPath={onSelectPath}
              apiBase={apiBase}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileManagerV2({ showToast, standalone = false, apiBase = '/api/files', jailRoot = '', dashboardHref }) {
  const jailed = Boolean(jailRoot);
  const homePath = jailed ? String(jailRoot).replace(/\/+$/, '') : '/var/www/sites';
  const dashLink = dashboardHref || (jailed ? '/' : '/filemanager');
  const jailUser = jailed ? homePath.split('/').filter(Boolean).pop() : '';

  const [currentPath, setCurrentPath] = useState(homePath);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [rootSubdirs, setRootSubdirs] = useState([]);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInputVal, setPathInputVal] = useState(currentPath);

  // Sorting: { field: 'name' | 'size' | 'mod_time' | 'mime_type', asc: boolean }
  const [sortConfig, setSortConfig] = useState({ field: 'name', asc: true });

  // Clipboard Buffer: { action: 'copy' | 'cut', sources: [] }
  const [clipboard, setClipboard] = useState(null);

  // Custom Context Menu State
  const [contextMenu, setContextMenu] = useState(null);

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
  const [chmodOwner, setChmodOwner] = useState(jailUser || 'www-data');
  const [chmodGroup, setChmodGroup] = useState(jailUser || 'www-data');
  const [chmodRecursive, setChmodRecursive] = useState(false);

  const [isChecksumOpen, setIsChecksumOpen] = useState(false);
  const [checksumData, setChecksumData] = useState(null);
  const [checksumFile, setChecksumFile] = useState(null);

  const [imagePreview, setImagePreview] = useState(null);
  const [isPathPickerOpen, setIsPathPickerOpen] = useState(false);
  const [pickerTargetDir, setPickerTargetDir] = useState('/var/www/sites');
  const [pickerSources, setPickerSources] = useState([]);
  const [pickerMode, setPickerMode] = useState('copy');

  const fileInputRef = useRef(null);

  // Fetch Root Directories for full / tree
  const fetchRootTree = async () => {
    try {
      const res = await fetch(`${apiBase}/subdirs?path=${encodeURIComponent(jailed ? homePath : '/')}`);
      if (res.ok) {
        const json = await res.json();
        setRootSubdirs(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFiles = async (path = currentPath) => {
    setLoading(true);
    setSelectedItems([]);
    setContextMenu(null);
    try {
      const res = await fetch(`${apiBase}?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const json = await res.json();
        setFiles(json.data || []);
        setCurrentPath(json.current_path || path);
        setPathInputVal(json.current_path || path);
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
    fetchRootTree();
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleOpenFolder = (path) => {
    if (jailed) {
      const clean = String(path || '').replace(/\/+$/, '') || homePath;
      if (clean !== homePath && !clean.startsWith(`${homePath}/`)) {
        showToast('Access denied: you cannot leave your home directory', 'error');
        return;
      }
    }
    fetchFiles(path);
  };

  const handleGoUp = () => {
    if (jailed && (currentPath === homePath || currentPath === `${homePath}/`)) {
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const parent = '/' + parts.join('/');
      if (jailed && (!parent.startsWith(homePath) || parent === '/')) {
        fetchFiles(homePath);
        return;
      }
      fetchFiles(parent || (jailed ? homePath : '/'));
    }
  };

  const handlePathInputSubmit = (e) => {
    e.preventDefault();
    setIsEditingPath(false);
    handleOpenFolder(pathInputVal);
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
      const res = await fetch(`${apiBase}/read?path=${encodeURIComponent(file.path)}`);
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
      const res = await fetch(`${apiBase}/save`, {
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
    const endpoint = clipboard.action === 'copy' ? `${apiBase}/copy` : `${apiBase}/move`;
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
    const endpoint = pickerMode === 'copy' ? `${apiBase}/copy` : `${apiBase}/move`;
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
      const res = await fetch(`${apiBase}/create`, {
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
      const res = await fetch(`${apiBase}/rename`, {
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
    if (!confirm(`Delete '${item.name}'?`)) return;
    try {
      const res = await fetch(`${apiBase}/delete`, {
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

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Delete ${selectedItems.length} selected item(s)?`)) return;
    for (const p of selectedItems) {
      try {
        await fetch(`${apiBase}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p }),
        });
      } catch (e) {
        console.error(e);
      }
    }
    showToast(`${selectedItems.length} items deleted`);
    fetchFiles(currentPath);
  };

  const handleArchive = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return;
    const destArchive = `${currentPath}/${archiveName}`;
    try {
      const res = await fetch(`${apiBase}/archive`, {
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
      const res = await fetch(`${apiBase}/extract`, {
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
      const res = await fetch(`${apiBase}/remote-download`, {
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
      const res = await fetch(`${apiBase}/grep`, {
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
      const res = await fetch(`${apiBase}/checksum?path=${encodeURIComponent(file.path)}`);
      const json = await res.json();
      if (res.ok) {
        setChecksumData(json.data);
        setIsChecksumOpen(true);
      }
    } catch (err) {
      showToast('Cannot calculate checksum', 'error');
    }
  };

  const handleFixPermissions = async () => {
    const targets = selectedItems.length > 0 ? selectedItems : [currentPath];
    try {
      const res = await fetch(`${apiBase}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, paths: targets }),
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
      const res = await fetch(`${apiBase}/chmod`, {
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
      const res = await fetch(`${apiBase}/upload`, {
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

  const selectAll = () => setSelectedItems(files.map(f => f.path));
  const selectNone = () => setSelectedItems([]);

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

  const folderCount = files.filter(f => f.is_dir).length;
  const fileCount = files.filter(f => !f.is_dir).length;
  const pathParts = currentPath.split('/').filter(Boolean);

  const activeTab = openTabs[activeTabIdx];

  return (
    <div className={`flex flex-col ${jailed ? 'h-full w-full' : 'h-screen w-screen'} bg-[#0a0a0c] select-none text-zinc-100 font-sans antialiased overflow-hidden`}>

      {/* 1. Top Blue Nav Bar (AKpanel Enterprise Brand Header) */}
      <header className="bg-[#0e1726] border-b border-blue-900/40 px-4 py-2.5 flex items-center justify-between shadow-md shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md">
              <FolderTree className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-white tracking-wider">AK<span className="text-blue-400">CONTROL</span></span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/30 text-blue-400 font-mono">
              {jailed ? 'Jailed' : 'Full v2'}
            </Badge>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleGoUp}
            disabled={currentPath === '/' || (jailed && (currentPath === homePath || currentPath === `${homePath}/`))}
            className="h-7 w-7 p-0 rounded-lg text-zinc-300 hover:text-white hover:bg-blue-900/40"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Interactive Breadcrumb Path */}
          {isEditingPath ? (
            <form onSubmit={handlePathInputSubmit} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={pathInputVal}
                onChange={(e) => setPathInputVal(e.target.value)}
                onBlur={() => setIsEditingPath(false)}
                className="bg-[#0a0f1d] border border-blue-500/50 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none w-64"
              />
              <button type="submit" className="text-xs text-blue-400 font-bold px-2">Go</button>
            </form>
          ) : (
            <div
              onClick={() => setIsEditingPath(true)}
              title="Click to type custom path"
              className="flex items-center gap-1 overflow-x-auto text-xs font-mono cursor-text"
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenFolder(jailed ? homePath : '/'); }}
                className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300 font-bold hover:bg-blue-900/80"
              >
                {jailed ? '~' : '/'}
              </button>
              {pathParts.map((part, idx) => {
                const sub = '/' + pathParts.slice(0, idx + 1).join('/');
                if (jailed && sub !== homePath && !sub.startsWith(`${homePath}/`)) {
                  return null;
                }
                return (
                  <React.Fragment key={sub}>
                    <span className="text-zinc-600 font-bold">/</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenFolder(sub); }}
                      className={`px-2 py-0.5 rounded uppercase font-bold text-[11px] transition ${idx === pathParts.length - 1
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white'
                        }`}
                    >
                      {part}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search All Files..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#0a0f1d] border border-blue-900/50 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <a
            href={dashLink}
            className="h-7 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </a>
        </div>
      </header>

      {/* 2. Action Buttons Toolbar */}
      <div className="bg-[#121215] border-b border-zinc-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-1 text-xs">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-200 gap-1.5 hover:bg-zinc-800 text-xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setNewItemIsDir(true); setIsCreateOpen(true); }}
            className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-200 gap-1.5 hover:bg-zinc-800 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Folder</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setNewItemIsDir(false); setIsCreateOpen(true); }}
            className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-200 gap-1.5 hover:bg-zinc-800 text-xs"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>+ File</span>
          </Button>

          <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={selectAll}
            className="h-7 px-2 rounded-lg text-zinc-300 hover:text-white gap-1 text-xs"
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>All</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={selectNone}
            className="h-7 px-2 rounded-lg text-zinc-400 hover:text-white gap-1 text-xs"
          >
            <Square className="w-3.5 h-3.5" />
            <span>None</span>
          </Button>

          {selectedItems.length > 0 && (
            <>
              <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                className="h-7 px-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 gap-1 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedItems.length})</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClipboardAction(selectedItems, 'copy')}
                className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-200 gap-1 text-xs"
              >
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>Copy</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClipboardAction(selectedItems, 'cut')}
                className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-200 gap-1 text-xs"
              >
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>Move</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setIsArchiveModalOpen(true)}
                className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Compress</span>
              </Button>
            </>
          )}

          {clipboard && (
            <Button
              size="sm"
              onClick={handlePasteClipboard}
              className="h-7 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold gap-1.5 animate-pulse"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste {clipboard.sources.length} Items</span>
            </Button>
          )}
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5 text-xs">
          <Button
            size="sm"
            variant="outline"
            onClick={handleFixPermissions}
            className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-emerald-400 hover:bg-zinc-800 gap-1 text-xs"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Fix Permissions</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsGrepOpen(true)}
            className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 gap-1 text-xs"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span>Grep</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsRemoteDownloadOpen(true)}
            className="h-7 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-cyan-400 hover:bg-zinc-800 gap-1 text-xs"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Wget</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchFiles(currentPath)}
            className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 3. Full-Height 2-Column Split Body (Tree Left + Table Right) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left Full Height Root Tree Sidebar */}
        <aside className="w-64 bg-[#0f0f12] border-r border-zinc-800/80 flex flex-col shrink-0 h-full overflow-hidden">

          <div className="px-3 py-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800/80 shrink-0">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-blue-400" />
              <span>Root Hierarchy</span>
            </span>
            <button onClick={() => handleOpenFolder(jailed ? homePath : '/')} className="hover:text-blue-400 text-xs font-mono font-bold">
              {jailed ? '~' : '/'}
            </button>
          </div>

          {/* Tree Scroll Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            <RootTreeNode
              path={jailed ? homePath : '/'}
              label={jailed ? jailUser || '~' : '/'}
              currentPath={currentPath}
              onSelectPath={handleOpenFolder}
              apiBase={apiBase}
            />
            {rootSubdirs.map(subPath => (
              <RootTreeNode
                key={subPath}
                path={subPath}
                currentPath={currentPath}
                onSelectPath={handleOpenFolder}
                apiBase={apiBase}
              />
            ))}
          </div>

          {/* Bottom Real Disk Meter */}
          <div className="border-t border-zinc-800/80 p-3 shrink-0 bg-[#0d0d10] space-y-1.5 text-[11px] font-mono">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-cyan-400" /> DISK USAGE</span>
              <span className="text-zinc-200 font-bold">60%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full w-3/5" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
              <span>Free: 45.2 GB</span>
              <span>Total: 100 GB</span>
            </div>
          </div>
        </aside>

        {/* Right Main Table Canvas */}
        <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0c0c0e] overflow-hidden">

          {/* Table Container that stretches full height */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#141418] sticky top-0 uppercase text-[10px] text-zinc-400 border-b border-zinc-800 font-semibold tracking-wider z-10 select-none">
                <tr>
                  <th className="py-2.5 px-3 w-10">
                    <Checkbox
                      checked={selectedItems.length === files.length && files.length > 0}
                      onCheckedChange={() => selectedItems.length === files.length ? selectNone() : selectAll()}
                    />
                  </th>
                  <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      <span>NAME</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('size')}>
                    <div className="flex items-center gap-1">
                      <span>SIZE</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('mod_time')}>
                    <div className="flex items-center gap-1">
                      <span>DATE</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3">OWNER</th>
                  <th className="py-2.5 px-3">GROUP</th>
                  <th className="py-2.5 px-3">PERMISSIONS</th>
                  <th className="py-2.5 px-3">TYPE</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 font-sans">
                {processedFiles.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-24 text-zinc-500">
                      <FolderTree className="w-10 h-10 text-zinc-600 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-zinc-400 text-sm">Empty directory</p>
                      <p className="text-zinc-500 text-xs mt-1">Upload or create a file to get started.</p>
                    </td>
                  </tr>
                ) : (
                  processedFiles.map(item => (
                    <tr
                      key={item.name}
                      className={`hover:bg-zinc-900/60 transition cursor-pointer ${selectedItems.includes(item.path) ? 'bg-blue-950/20 ring-1 ring-blue-500/40' : ''
                        }`}
                      onClick={() => toggleSelectItem(item.path)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                    >
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedItems.includes(item.path)}
                          onCheckedChange={() => toggleSelectItem(item.path)}
                        />
                      </td>

                      <td className="py-2 px-3 font-semibold text-white flex items-center gap-2">
                        {item.is_dir ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : item.is_image ? (
                          <FileImage className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : item.is_archive ? (
                          <FolderArchive className="w-4 h-4 text-indigo-400 shrink-0" />
                        ) : (
                          <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                        <span className="font-mono text-xs hover:text-blue-400 transition truncate max-w-xs">{item.name}</span>
                      </td>

                      <td className="py-2 px-3 font-mono text-zinc-400">{item.human_size}</td>

                      <td className="py-2 px-3 font-mono text-zinc-400 text-[11px]">{item.date_formatted}</td>

                      <td className="py-2 px-3 font-mono text-zinc-400 text-[11px]">{item.owner}</td>
                      <td className="py-2 px-3 font-mono text-zinc-400 text-[11px]">{item.group}</td>

                      <td className="py-2 px-3 font-mono">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setChmodTarget(item);
                            setChmodMode(item.octal_perm || '0755');
                            setChmodOwner(item.owner || 'www-data');
                            setChmodGroup(item.group || 'www-data');
                            setIsChmodOpen(true);
                          }}
                          className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 text-[11px]"
                        >
                          {item.octal_perm}
                        </span>
                      </td>

                      <td className="py-2 px-3 font-mono text-zinc-500 text-[11px] truncate max-w-32">{item.mime_type}</td>

                      <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">

                          {!item.is_dir && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenFile(item)}
                              title="Edit in VS Code"
                              className="h-6 w-6 p-0 rounded-lg text-zinc-400 hover:text-white"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setChmodTarget(item);
                              setChmodMode(item.octal_perm || '0755');
                              setChmodOwner(item.owner || 'www-data');
                              setChmodGroup(item.group || 'www-data');
                              setIsChmodOpen(true);
                            }}
                            title="Permissions"
                            className="h-6 w-6 p-0 rounded-lg text-zinc-400 hover:text-emerald-400"
                          >
                            <Shield className="w-3 h-3" />
                          </Button>

                          <a
                            href={`${apiBase}/download?path=${encodeURIComponent(item.path)}`}
                            download
                            title="Download"
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition"
                          >
                            <Download className="w-3 h-3" />
                          </a>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item)}
                            title="Delete"
                            className="h-6 w-6 p-0 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 4. Bottom Status Bar Glued to the Bottom */}
          <footer className="bg-[#141418] border-t border-zinc-800/80 px-4 py-2 flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0">
            <div className="flex items-center gap-4">
              <span>📁 {folderCount} Folder(s) / 📄 {fileCount} File(s)</span>
              <span>• Total: {files.length} items</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Path:</span>
              <span className="text-zinc-200 font-bold">{currentPath}</span>
            </div>
          </footer>

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
            <span>Cut / Move</span>
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
            href={`${apiBase}/download?path=${encodeURIComponent(contextMenu.item.path)}`}
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

      {/* Mini Path Explorer Modal */}
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
              <RootTreeNode
                path={jailed ? homePath : '/'}
                label={jailed ? jailUser || '~' : '/'}
                currentPath={pickerTargetDir}
                onSelectPath={setPickerTargetDir}
                apiBase={apiBase}
              />
              {rootSubdirs.map(subPath => (
                <RootTreeNode
                  key={subPath}
                  path={subPath}
                  currentPath={pickerTargetDir}
                  onSelectPath={setPickerTargetDir}
                  apiBase={apiBase}
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
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono cursor-pointer transition ${activeTabIdx === idx
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

                <Button size="sm" variant="ghost" onClick={() => setIsEditorModalOpen(false)} className="rounded-xl text-zinc-400 hover:text-white">
                  Close
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
                src={`${apiBase}/download?path=${encodeURIComponent(imagePreview.path)}`}
                alt={imagePreview.name}
                className="max-h-96 max-w-full object-contain rounded-xl shadow-lg"
              />
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
                  value={jailed ? jailUser : chmodOwner}
                  onChange={(e) => setChmodOwner(e.target.value)}
                  disabled={jailed}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Group Owner</label>
                <Input
                  value={jailed ? jailUser : chmodGroup}
                  onChange={(e) => setChmodGroup(e.target.value)}
                  disabled={jailed}
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
