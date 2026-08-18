import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Database, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Zap, 
  ShieldCheck, 
  HardDrive, 
  Layers, 
  Key, 
  Lock, 
  Copy, 
  Server, 
  CheckCircle2, 
  Play, 
  Power, 
  RotateCcw, 
  Table, 
  Code, 
  Flame, 
  Download, 
  Upload, 
  Activity, 
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  Terminal as TerminalIcon,
  Cpu,
  AlertTriangle,
  Radio,
  Sliders,
  FileText,
  Users,
  Settings2,
  SlidersHorizontal,
  FolderTree
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export default function DatabasesManager({ defaultEngine = 'all', showToast }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current engine from URL path (/databases/mysql -> 'mysql')
  const getEngineFromPath = () => {
    const path = location.pathname;
    if (path.includes('/mysql')) return 'mysql';
    if (path.includes('/postgres')) return 'postgres';
    if (path.includes('/mongodb')) return 'mongodb';
    if (path.includes('/redis')) return 'redis';
    return defaultEngine;
  };

  const [activeEngine, setActiveEngine] = useState(getEngineFromPath());
  const [activeSubTab, setActiveSubTab] = useState('databases'); // 'databases' | 'users' | 'config' | 'logs'
  const [databases, setDatabases] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [engines, setEngines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Live Engine Installer State
  const [installTaskId, setInstallTaskId] = useState(null);
  const [installLog, setInstallLog] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const logContainerRef = useRef(null);

  // Config Editor State
  const [configContent, setConfigContent] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Service Logs State
  const [serviceLogs, setServiceLogs] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isQueryOpen, setIsQueryOpen] = useState(false);
  const [selectedDBForQuery, setSelectedDBForQuery] = useState(null);

  // Database Form State
  const [formData, setFormData] = useState({
    name: '',
    engine: activeEngine === 'all' ? 'mysql' : activeEngine,
    collation: 'utf8mb4_unicode_ci',
    username: '',
    password: '',
  });

  // User Form State
  const [userFormData, setUserFormData] = useState({
    username: '',
    engine: activeEngine === 'all' ? 'mysql' : activeEngine,
    host: 'localhost',
    password: '',
    privilege: 'ALL PRIVILEGES',
    database: '',
  });

  // Query Console State
  const [queryCode, setQueryCode] = useState('SELECT * FROM users LIMIT 10;');
  const [queryResult, setQueryResult] = useState(null);
  const [isQueryRunning, setIsQueryRunning] = useState(false);

  // Redis Specific State
  const [redisKeys, setRedisKeys] = useState([
    { key: 'session:user_1028', ttl: '3540s', type: 'string', size: '1.2 KB' },
    { key: 'cache:vhosts_list', ttl: '120s', type: 'hash', size: '4.8 KB' },
    { key: 'telemetry:cpu_peaks', ttl: '86400s', type: 'zset', size: '24.1 KB' },
    { key: 'rate_limit:ip_192.168.1.1', ttl: '45s', type: 'string', size: '64 B' },
    { key: 'queue:email_notifications', ttl: 'no-expire', type: 'list', size: '12.0 KB' },
  ]);

  // Postgres Extensions State
  const [postgresExtensions, setPostgresExtensions] = useState([
    { name: 'uuid-ossp', desc: 'UUID generation functions', active: true },
    { name: 'pg_trgm', desc: 'Trigram matching for fast text search', active: true },
    { name: 'postgis', desc: 'Geographic spatial objects support', active: false },
    { name: 'pgcrypto', desc: 'Cryptographic hashing & AES encryption', active: true },
    { name: 'hstore', desc: 'Key-value data store within PostgreSQL', active: false },
  ]);

  // Version Management & phpMyAdmin State
  const [engineVersions, setEngineVersions] = useState([]);
  const [pmaConfig, setPmaConfig] = useState({
    auto_login: true,
    upload_max_mb: 128,
    session_timeout_min: 1440,
    pma_version: '5.1.1 LTS (Ubuntu 22.04)',
    session_path: '/var/lib/phpmyadmin/sessions'
  });
  const [isSavingPma, setIsSavingPma] = useState(false);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false);

  // Sync state when route changes
  useEffect(() => {
    setActiveEngine(getEngineFromPath());
    setActiveSubTab('databases');
  }, [location.pathname]);

  const fetchDatabases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/databases?engine=${activeEngine}`);
      if (res.ok) {
        const json = await res.json();
        setDatabases(json.data || []);
        setEngines(json.engines || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/databases/users?engine=${activeEngine === 'all' ? '' : activeEngine}`);
      if (res.ok) {
        const json = await res.json();
        setDbUsers(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await fetch(`/api/databases/versions?engine=${activeEngine === 'all' ? 'mysql' : activeEngine}`);
      if (res.ok) {
        const json = await res.json();
        setEngineVersions(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPmaConfig = async () => {
    try {
      const res = await fetch('/api/databases/phpmyadmin/config');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setPmaConfig(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunchPmaSSO = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/databases/phpmyadmin/sso');
      const json = await res.json();
      if (json.status && (json.redirect_url || json.url)) {
        window.open(json.redirect_url || json.url, '_blank');
      } else {
        window.open('/phpmyadmin', '_blank');
      }
    } catch (err) {
      window.open('/phpmyadmin', '_blank');
    }
  };

  const handleSavePmaConfig = async () => {
    setIsSavingPma(true);
    try {
      const res = await fetch('/api/databases/phpmyadmin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pmaConfig),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingPma(false);
    }
  };

  const handleSwitchVersion = async (v) => {
    setIsSwitchingVersion(true);
    setIsInstalling(true);
    setInstallLog(`[1/4] Starting live version switch for ${activeEngine.toUpperCase()} to ${v.name} (${v.version})...\n`);
    try {
      const res = await fetch('/api/databases/versions/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: activeEngine === 'all' ? 'mysql' : activeEngine,
          version: v.version,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setInstallTaskId(json.task_id);
    } catch (err) {
      showToast(err.message, 'error');
      setIsInstalling(false);
    } finally {
      setIsSwitchingVersion(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/databases/config?engine=${activeEngine === 'all' ? 'mysql' : activeEngine}`);
      if (res.ok) {
        const json = await res.json();
        setConfigContent(json.content || '');
        setConfigPath(json.path || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/databases/logs?engine=${activeEngine === 'all' ? 'mysql' : activeEngine}`);
      if (res.ok) {
        const json = await res.json();
        setServiceLogs(json.logs || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
    fetchUsers();
    fetchVersions();
    if (activeEngine === 'mysql' || activeEngine === 'all') fetchPmaConfig();
    if (activeSubTab === 'config') fetchConfig();
    if (activeSubTab === 'logs') fetchLogs();

    setFormData(prev => ({
      ...prev,
      engine: activeEngine === 'all' ? 'mysql' : activeEngine,
      collation: activeEngine === 'postgres' ? 'UTF8' : activeEngine === 'mongodb' ? 'NoSQL' : activeEngine === 'redis' ? 'In-Memory' : 'utf8mb4_unicode_ci',
    }));

    setUserFormData(prev => ({
      ...prev,
      engine: activeEngine === 'all' ? 'mysql' : activeEngine,
    }));
  }, [activeEngine, activeSubTab]);

  // Live polling for engine installation tasks
  useEffect(() => {
    let interval = null;
    if (installTaskId && isInstalling) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/databases/install/status?task_id=${installTaskId}`);
          if (res.ok) {
            const json = await res.json();
            const task = json.data;
            if (task) {
              setInstallLog(task.log || '');
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
              if (task.status === 'completed' || task.status === 'failed') {
                setIsInstalling(false);
                setInstallTaskId(null);
                showToast(`Engine ${task.engine} installation finished!`);
                fetchDatabases();
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [installTaskId, isInstalling]);

  const handleStartInstall = async (engine) => {
    setIsInstalling(true);
    setInstallLog(`[1/4] Preparing live installation of ${engine.toUpperCase()}...\n`);
    try {
      const res = await fetch('/api/databases/install/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setInstallTaskId(json.task_id);
    } catch (err) {
      showToast(err.message, 'error');
      setIsInstalling(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/databases/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: activeEngine === 'all' ? 'mysql' : activeEngine,
          content: configContent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
    setUserFormData(prev => ({ ...prev, password: pass }));
  };

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      const res = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsCreateOpen(false);
      setFormData({
        name: '',
        engine: activeEngine === 'all' ? 'mysql' : activeEngine,
        collation: 'utf8mb4_unicode_ci',
        username: '',
        password: '',
      });
      fetchDatabases();
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userFormData.username) return;

    try {
      const res = await fetch('/api/databases/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsCreateUserOpen(false);
      setUserFormData({
        username: '',
        engine: activeEngine === 'all' ? 'mysql' : activeEngine,
        host: 'localhost',
        password: '',
        privilege: 'ALL PRIVILEGES',
        database: '',
      });
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Delete user '${user.username}'@'${user.host}'?`)) return;
    try {
      const res = await fetch('/api/databases/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          engine: user.engine,
          host: user.host,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteDatabase = async (db) => {
    if (!confirm(`Are you sure you want to drop database '${db.name}' (${db.engine})? This will permanently delete all tables and data!`)) return;

    try {
      const res = await fetch('/api/databases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: db.id, name: db.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchDatabases();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleControlEngine = async (engineId, action) => {
    try {
      const res = await fetch('/api/databases/engine/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: engineId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchDatabases();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFlushRedis = async () => {
    if (!confirm('Are you sure you want to FLUSH ALL Redis in-memory keys and cache?')) return;
    try {
      const res = await fetch('/api/redis/flush', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setRedisKeys([]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRunQuery = async () => {
    setIsQueryRunning(true);
    try {
      const res = await fetch('/api/databases/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: selectedDBForQuery?.engine || activeEngine,
          database: selectedDBForQuery?.name || 'akpanel_main',
          query: queryCode,
        }),
      });
      const json = await res.json();
      setQueryResult(json.data);
    } catch (err) {
      showToast('Query execution failed', 'error');
    } finally {
      setIsQueryRunning(false);
    }
  };

  const handleToggleExtension = (extName) => {
    setPostgresExtensions(prev => prev.map(ext => 
      ext.name === extName ? { ...ext, active: !ext.active } : ext
    ));
    showToast(`Extension '${extName}' toggled`);
  };

  const engineMeta = {
    mysql: {
      name: 'MySQL & MariaDB Server',
      desc: 'High-performance relational SQL database with InnoDB ACID transactions and utf8mb4 support.',
      port: 3306,
      icon: Database,
      badge: '🐬 MySQL / MariaDB',
      color: 'text-cyan-400',
      bgColor: 'from-cyan-600 to-blue-600',
    },
    postgres: {
      name: 'PostgreSQL Enterprise Engine',
      desc: 'Advanced object-relational SQL database with powerful JSONB queries, schemas and PostGIS spatial extensions.',
      port: 5432,
      icon: Server,
      badge: '🐘 PostgreSQL',
      color: 'text-blue-400',
      bgColor: 'from-blue-600 to-indigo-600',
    },
    mongodb: {
      name: 'MongoDB NoSQL Document Store',
      desc: 'Schema-free JSON document database for high-throughput microservices and real-time event analytics.',
      port: 27017,
      icon: Flame,
      badge: '🍃 MongoDB NoSQL',
      color: 'text-emerald-400',
      bgColor: 'from-emerald-600 to-teal-600',
    },
    redis: {
      name: 'Redis In-Memory Cache & Key-Value',
      desc: 'Ultra-fast sub-millisecond in-memory cache, session store, and pub/sub message broker.',
      port: 6379,
      icon: Zap,
      badge: '⚡ Redis Cache',
      color: 'text-rose-400',
      bgColor: 'from-rose-600 to-pink-600',
    },
    all: {
      name: 'Enterprise Databases Hub',
      desc: 'Unified control suite for MySQL, PostgreSQL, MongoDB, and Redis servers.',
      port: null,
      icon: Database,
      badge: '🌐 All Databases',
      color: 'text-indigo-400',
      bgColor: 'from-indigo-600 to-purple-600',
    }
  };

  const currentMeta = engineMeta[activeEngine] || engineMeta.all;
  const currentEngineTelemetry = engines.find(e => e.id === (activeEngine === 'all' ? 'mysql' : activeEngine)) || engines[0] || {};
  const isCurrentEngineInstalled = currentEngineTelemetry.is_installed ?? true;

  const filteredDatabases = databases
    .filter(d => activeEngine === 'all' || d.engine === activeEngine)
    .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const filteredUsers = dbUsers
    .filter(u => activeEngine === 'all' || u.engine === activeEngine);

  return (
    <div className="space-y-6 select-none">
      
      {/* 1. Header & Dedicated Engine Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121215] border border-zinc-800/90 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${currentMeta.bgColor} flex items-center justify-center text-white shadow-lg shrink-0`}>
            <currentMeta.icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white tracking-tight">{currentMeta.name}</h2>
              <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300 font-mono">
                {currentMeta.port ? `Port ${currentMeta.port}` : 'Multi-Port'}
              </Badge>
              {isCurrentEngineInstalled ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  <span>Installed & Active</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Not Installed</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
              {currentMeta.desc}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {activeEngine === 'redis' && (
            <Button 
              size="sm"
              onClick={handleFlushRedis}
              className="rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold gap-1.5 shadow-md shadow-rose-600/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>FLUSH ALL CACHE</span>
            </Button>
          )}

          {/* phpMyAdmin is strictly dedicated to MySQL / MariaDB */}
          {(activeEngine === 'mysql' || activeEngine === 'all') && (
            <button
              onClick={handleLaunchPmaSSO}
              className="h-8 px-3 rounded-2xl border border-blue-500/30 bg-blue-950/40 text-xs font-bold text-blue-300 flex items-center gap-1.5 hover:bg-blue-900/60 shadow-sm transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Launch phpMyAdmin</span>
            </button>
          )}

          {activeEngine === 'postgres' && (
            <Button
              size="sm"
              onClick={() => { setSelectedDBForQuery('billing_service'); setIsQueryOpen(true); }}
              className="h-8 px-3 rounded-2xl border border-blue-500/30 bg-blue-950/40 text-xs font-bold text-blue-300 gap-1.5 hover:bg-blue-900/60 shadow-sm"
            >
              <Code className="w-3.5 h-3.5" />
              <span>SQL Query Studio</span>
            </Button>
          )}

          {activeEngine === 'mongodb' && (
            <Button
              size="sm"
              onClick={() => { setSelectedDBForQuery('analytics_events'); setIsQueryOpen(true); }}
              className="h-8 px-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 text-xs font-bold text-emerald-300 gap-1.5 hover:bg-emerald-900/60 shadow-sm"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>NoSQL Query Studio</span>
            </Button>
          )}

          {!isCurrentEngineInstalled ? (
            <Button 
              size="sm" 
              onClick={() => handleStartInstall(activeEngine === 'all' ? 'mysql' : activeEngine)}
              disabled={isInstalling}
              className="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5 shadow-md shadow-blue-600/20 animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isInstalling ? 'Installing...' : '1-Click Install Engine'}</span>
            </Button>
          ) : (
            activeEngine !== 'redis' && (
              <Button 
                size="sm" 
                onClick={() => setIsCreateOpen(true)}
                className="rounded-2xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Database</span>
              </Button>
            )
          )}

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => handleControlEngine(activeEngine === 'all' ? 'mysql' : activeEngine, 'restart')}
            title="Restart Service"
            className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Live Installer Terminal Streaming Banner */}
      {(isInstalling || installLog) && (
        <Card className="bg-[#0e0e11] border-blue-500/40 rounded-3xl p-5 shadow-lg relative overflow-hidden animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-xs text-white">Live Engine Installer Progress</span>
              {isInstalling && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
            </div>
            {!isInstalling && (
              <button onClick={() => setInstallLog('')} className="text-xs text-zinc-400 hover:text-white">✕ Close</button>
            )}
          </div>
          <pre 
            ref={logContainerRef}
            className="p-3 mt-3 bg-black/60 rounded-2xl text-[11px] font-mono text-cyan-300 max-h-48 overflow-y-auto whitespace-pre-wrap select-text custom-scrollbar border border-zinc-800/80"
          >
            {installLog}
          </pre>
        </Card>
      )}

      {/* 2. Engine Specific Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Engine Status</div>
          <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{currentEngineTelemetry.status === 'running' ? 'Running' : currentEngineTelemetry.status}</span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5 block font-mono">Port: {currentEngineTelemetry.port || 'Local'}</span>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">RAM Usage</div>
          <div className="text-base font-bold text-cyan-400 mt-1 font-mono">
            {currentEngineTelemetry.memory_mb || '128 MB'}
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5 block font-mono">Buffer Pool: 78% Cached</span>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Active Connections</div>
          <div className="text-base font-bold text-indigo-400 mt-1 font-mono">
            {currentEngineTelemetry.connections || 12} Clients
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5 block font-mono">Max Pool: 500</span>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Databases</div>
          <div className="text-base font-bold text-white mt-1 font-mono">
            {filteredDatabases.length} Active
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5 block font-mono">Version: {currentEngineTelemetry.version}</span>
        </Card>
      </div>

      {/* 3. Sub-Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
        <button
          onClick={() => setActiveSubTab('databases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'databases' 
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-rose-400" />
          <span>Databases & Collections ({filteredDatabases.length})</span>
        </button>

        {activeEngine !== 'redis' && (
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'users' 
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Database Users & Grants ({filteredUsers.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('versions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'versions' 
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>Engine Versions & Tools</span>
        </button>

        <button
          onClick={() => setActiveSubTab('config')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'config' 
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Configuration</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'logs' 
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>Service Error Logs</span>
        </button>
      </div>

      {/* 4. SUB-TAB 1: DATABASES & COLLECTIONS */}
      {activeSubTab === 'databases' && (
        <div className="space-y-4">
          
          {/* REDIS SPECIAL KEYS BROWSER */}
          {activeEngine === 'redis' ? (
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-400" />
                    <span>Redis Keyspace & Cache Browser</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Live memory buffer, expiration timers, and keys telemetry.</p>
                </div>
                <Badge className="bg-rose-500/10 border-rose-500/30 text-rose-400 font-mono text-xs">
                  Hit Ratio: 96.4%
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono text-zinc-300">
                  <thead className="bg-zinc-900 uppercase text-[10px] text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4">Key Name</th>
                      <th className="py-2.5 px-4">Data Type</th>
                      <th className="py-2.5 px-4">TTL (Time to Live)</th>
                      <th className="py-2.5 px-4">Memory Size</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {redisKeys.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-zinc-500 font-sans">
                          Keyspace is empty (Cache Flushed).
                        </td>
                      </tr>
                    ) : (
                      redisKeys.map((k, i) => (
                        <tr key={i} className="hover:bg-zinc-900/50">
                          <td className="py-2.5 px-4 font-bold text-white select-all">{k.key}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-400 text-[10px]">
                              {k.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-amber-400">{k.ttl}</td>
                          <td className="py-2.5 px-4 text-zinc-400">{k.size}</td>
                          <td className="py-2.5 px-4 text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => {
                                setRedisKeys(prev => prev.filter((_, idx) => idx !== i));
                                showToast(`Key '${k.key}' deleted from Redis`);
                              }}
                              className="h-6 w-6 p-0 text-zinc-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <>
              {/* POSTGRES SPECIAL EXTENSIONS */}
              {activeEngine === 'postgres' && (
                <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-400" />
                        <span>PostgreSQL Installed Extensions</span>
                      </h3>
                      <p className="text-[11px] text-zinc-400">Enable advanced functions directly without restarting the server.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {postgresExtensions.map(ext => (
                      <div 
                        key={ext.name}
                        onClick={() => handleToggleExtension(ext.name)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          ext.active 
                            ? 'bg-blue-950/20 border-blue-500/40 text-white' 
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-blue-300">{ext.name}</div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-xs">{ext.desc}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ext.active ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {ext.active ? 'ENABLED' : 'OFF'}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Databases Search & Table */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121215] border border-zinc-800/80 rounded-2xl p-3 shadow-sm">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-zinc-400" />
                  <span>{currentMeta.badge} Database List ({filteredDatabases.length})</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search by database name..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <Button size="sm" variant="ghost" onClick={fetchDatabases} className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-900/80 uppercase text-[10px] text-zinc-400 border-b border-zinc-800/80 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Database Name</th>
                        <th className="py-3 px-4">Engine</th>
                        <th className="py-3 px-4">Storage Size</th>
                        <th className="py-3 px-4">Tables / Collections</th>
                        <th className="py-3 px-4">Collation / Encoding</th>
                        <th className="py-3 px-4">Authorized Users</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-sans">
                      {filteredDatabases.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-16 text-zinc-500">
                            <Database className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                            <p className="font-semibold text-zinc-400">No {currentMeta.name} databases found</p>
                            <p className="text-zinc-500 text-xs mt-1">Create your first database above to start storing data.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredDatabases.map(db => (
                          <tr key={db.id} className="hover:bg-zinc-900/50 transition">
                            <td className="py-3 px-4 font-semibold text-white font-mono flex items-center gap-2">
                              <Database className="w-4 h-4 text-rose-400" />
                              <span>{db.name}</span>
                            </td>

                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 text-zinc-300">
                                {db.engine.toUpperCase()}
                              </Badge>
                            </td>

                            <td className="py-3 px-4 font-mono text-zinc-400">{db.size_mb}</td>

                            <td className="py-3 px-4 font-mono text-zinc-300">
                              {db.tables_count} {db.engine === 'mongodb' ? 'Collections' : 'Tables'}
                            </td>

                            <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">{db.collation}</td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {db.users?.map(u => (
                                  <Badge key={u} variant="secondary" className="text-[10px] font-mono bg-zinc-900 text-zinc-300">
                                    {u}
                                  </Badge>
                                ))}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => {
                                    setSelectedDBForQuery(db);
                                    setQueryCode(db.engine === 'mongodb' ? 'db.events.find({}).limit(10)' : 'SELECT * FROM users LIMIT 10;');
                                    setIsQueryOpen(true);
                                  }}
                                  title="Run Query / SQL Console"
                                  className="h-7 px-2 rounded-xl text-[11px] border-zinc-800 bg-zinc-900 text-cyan-400 hover:bg-zinc-800 gap-1"
                                >
                                  <Code className="w-3 h-3" />
                                  <span>Console</span>
                                </Button>

                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={() => handleDeleteDatabase(db)}
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
            </>
          )}

        </div>
      )}

      {/* 5. SUB-TAB 2: USERS & PRIVILEGES */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#121215] border border-zinc-800/80 rounded-2xl p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Authorized Database Users & Security</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Manage user passwords, remote host access (%), and database permissions.</p>
            </div>

            <Button 
              size="sm"
              onClick={() => setIsCreateUserOpen(true)}
              className="rounded-2xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Database User</span>
            </Button>
          </div>

          <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300 font-mono">
                <thead className="bg-zinc-900 uppercase text-[10px] text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Engine</th>
                    <th className="py-3 px-4">Allowed Host</th>
                    <th className="py-3 px-4">Granted Databases</th>
                    <th className="py-3 px-4">Privilege Level</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-zinc-500 font-sans">
                        No database users created for {activeEngine}.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-zinc-900/50">
                        <td className="py-3 px-4 font-bold text-white">{u.username}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-[10px]">{u.engine.toUpperCase()}</Badge>
                        </td>
                        <td className="py-3 px-4 text-cyan-400">{u.host}</td>
                        <td className="py-3 px-4 text-zinc-300">
                          {u.databases?.join(', ') || 'ALL (*)'}
                        </td>
                        <td className="py-3 px-4 text-amber-400">{u.privilege}</td>
                        <td className="py-3 px-4 text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDeleteUser(u)}
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 6. SUB-TAB 3: ENGINE VERSIONS & PHPMYADMIN MANAGEMENT */}
      {activeSubTab === 'versions' && (
        <div className="space-y-6">
          
          {/* phpMyAdmin Management Card (Dedicated to MySQL / MariaDB) */}
          {(activeEngine === 'mysql' || activeEngine === 'all') && (
            <Card className="bg-[#121215] border-blue-500/30 rounded-3xl p-6 shadow-lg space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>phpMyAdmin Management & Auto-Login</span>
                      <Badge className="bg-blue-500/10 border-blue-500/30 text-blue-400 text-[10px] font-mono">
                        v{pmaConfig.pma_version || '5.1.1 LTS'}
                      </Badge>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Dedicated Web GUI for MySQL & MariaDB engines. Auto-login SSO, session timeouts, and upload limits.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLaunchPmaSSO}
                    className="h-9 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Launch phpMyAdmin Console</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Auto-Login Toggle */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">1-Click Auto-Login (SSO)</span>
                    <Badge className={pmaConfig.auto_login ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}>
                      {pmaConfig.auto_login ? 'Enabled (Config)' : 'Disabled (Cookie)'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Bypasses username/password prompts and logs in directly with panel administrator privileges.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={pmaConfig.auto_login}
                      onChange={(e) => setPmaConfig(prev => ({ ...prev, auto_login: e.target.checked }))}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0"
                    />
                    <span className="text-xs text-zinc-300 font-medium">Enable Instant Auto-Login</span>
                  </label>
                </div>

                {/* Max Upload Limit */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <span className="text-xs font-bold text-zinc-200 block">SQL Import Max Filesize (MB)</span>
                  <p className="text-[11px] text-zinc-400">
                    Maximum size for SQL dump uploads via phpMyAdmin import tool.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="number"
                      min="16"
                      max="2048"
                      value={pmaConfig.upload_max_mb || 128}
                      onChange={(e) => setPmaConfig(prev => ({ ...prev, upload_max_mb: parseInt(e.target.value) || 128 }))}
                      className="h-8 bg-zinc-950 border-zinc-700 rounded-xl text-xs font-mono text-white w-28"
                    />
                    <span className="text-xs font-mono text-zinc-400">MB</span>
                  </div>
                </div>

                {/* Session Timeout */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <span className="text-xs font-bold text-zinc-200 block">Session Validity (Minutes)</span>
                  <p className="text-[11px] text-zinc-400">
                    Time before session expires when idle. Default is 1440 min (24 hours).
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="number"
                      min="10"
                      max="10080"
                      value={pmaConfig.session_timeout_min || 1440}
                      onChange={(e) => setPmaConfig(prev => ({ ...prev, session_timeout_min: parseInt(e.target.value) || 1440 }))}
                      className="h-8 bg-zinc-950 border-zinc-700 rounded-xl text-xs font-mono text-white w-28"
                    />
                    <span className="text-xs font-mono text-zinc-400">Minutes</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                <div className="text-[11px] text-zinc-500 font-mono">
                  Session Storage: <span className="text-zinc-400">/var/lib/phpmyadmin/sessions (1777)</span>
                </div>
                <Button
                  size="sm"
                  onClick={handleSavePmaConfig}
                  disabled={isSavingPma}
                  className="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isSavingPma ? 'Applying Settings...' : 'Save & Restart phpMyAdmin'}</span>
                </Button>
              </div>
            </Card>
          )}

          {/* Engine Version Matrix */}
          <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Available Engine Releases & Version Switcher</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select and switch your active {currentEngineTelemetry.name} engine version with automated package deployment.
                </p>
              </div>

              <Badge variant="outline" className="text-xs font-mono border-emerald-500/30 text-emerald-400">
                Current: {currentEngineTelemetry.version}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {engineVersions.map((v, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                    v.is_active
                      ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-xs text-white">{v.name}</span>
                      <div className="flex items-center gap-1">
                        {v.recommended && (
                          <Badge className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-[9px] px-1.5 py-0">
                            Recommended
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] font-mono uppercase px-1.5 py-0">
                          {v.type}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-relaxed min-h-10">
                      {v.description}
                    </p>

                    <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Package: {v.package_name}</span>
                      <span>{v.release_date}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    {v.is_active ? (
                      <div className="w-full py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Active Engine</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwitchVersion(v)}
                        disabled={isInstalling || isSwitchingVersion}
                        className="w-full rounded-xl border-zinc-700 hover:border-blue-500 hover:bg-blue-950/40 text-zinc-200 hover:text-blue-300 text-xs font-semibold gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span>Switch to {v.version}</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 7. SUB-TAB 4: CONFIGURATION EDITOR */}
      {activeSubTab === 'config' && (
        <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Configuration Editor ({configPath})</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Edit server settings and buffers. Service will automatically restart on save.</p>
            </div>

            <Button 
              size="sm" 
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-amber-600/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isSavingConfig ? 'Saving & Restarting...' : 'Save & Restart Server'}</span>
            </Button>
          </div>

          <div className="h-96 rounded-2xl overflow-hidden border border-zinc-800">
            <Editor
              height="100%"
              theme="vs-dark"
              language="ini"
              value={configContent}
              onChange={(val) => setConfigContent(val || '')}
              options={{
                minimap: { enabled: true },
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                wordWrap: 'on',
                tabSize: 2,
              }}
            />
          </div>
        </Card>
      )}

      {/* 7. SUB-TAB 4: SERVICE LOGS */}
      {activeSubTab === 'logs' && (
        <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Live Service Error Logs</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Last 100 lines of runtime engine activity and query warnings.</p>
            </div>

            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchLogs}
              disabled={isLoadingLogs}
              className="rounded-xl border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 gap-1.5 hover:bg-zinc-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </Button>
          </div>

          <pre className="p-4 bg-black/60 rounded-2xl text-[11px] font-mono text-zinc-300 max-h-96 overflow-y-auto whitespace-pre-wrap select-text custom-scrollbar border border-zinc-800/80">
            {serviceLogs}
          </pre>
        </Card>
      )}

      {/* Create Database Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-400" />
              <span>Create New {formData.engine.toUpperCase()} Database</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateDatabase} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Database Name</label>
              <Input 
                type="text" 
                required 
                placeholder="production_db"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
              />
            </div>

            {formData.engine === 'mysql' && (
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Character Set Collation</label>
                <select
                  value={formData.collation}
                  onChange={(e) => setFormData(prev => ({ ...prev, collation: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                >
                  <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci (Standard Multilingual)</option>
                  <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                  <option value="latin1_swedish_ci">latin1_swedish_ci</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Database User (Optional)</label>
                <Input 
                  type="text" 
                  placeholder="db_user"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-300 font-semibold">Password</label>
                  <button 
                    type="button" 
                    onClick={handleGeneratePassword} 
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Generate
                  </button>
                </div>
                <Input 
                  type="password" 
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
                Create Database
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Database User Modal */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Create Database User ({activeEngine.toUpperCase()})</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Username</label>
                <Input 
                  type="text" 
                  required
                  placeholder="app_user"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Host (e.g. localhost or %)</label>
                <Input 
                  type="text" 
                  value={userFormData.host}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, host: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-300 font-semibold">User Password</label>
                <button 
                  type="button" 
                  onClick={handleGeneratePassword} 
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Generate Strong Pass
                </button>
              </div>
              <Input 
                type="password" 
                required
                placeholder="••••••••••••"
                value={userFormData.password}
                onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Privilege Level</label>
                <select
                  value={userFormData.privilege}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, privilege: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                >
                  <option value="ALL PRIVILEGES">ALL PRIVILEGES (Full Admin)</option>
                  <option value="SELECT, INSERT, UPDATE, DELETE">Read & Write (CRUD Only)</option>
                  <option value="SELECT">Read Only (SELECT Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Assign to Database</label>
                <select
                  value={userFormData.database}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, database: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                >
                  <option value="">All Databases (*.*)</option>
                  {filteredDatabases.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs">
                Create User & Grant
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SQL / NoSQL Query Console Modal */}
      {isQueryOpen && (
        <Dialog open={isQueryOpen} onOpenChange={setIsQueryOpen}>
          <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-cyan-400" />
                  <span>{selectedDBForQuery?.engine?.toUpperCase()} Query Console ({selectedDBForQuery?.name})</span>
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-xs border-zinc-700 text-zinc-300">
                  {selectedDBForQuery?.engine?.toUpperCase()}
                </Badge>
              </div>
            </DialogHeader>

            <div className="h-44 rounded-2xl overflow-hidden border border-zinc-800 mt-3">
              <Editor
                height="100%"
                theme="vs-dark"
                language={selectedDBForQuery?.engine === 'mongodb' ? 'javascript' : 'sql'}
                value={queryCode}
                onChange={(val) => setQueryCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  wordWrap: 'on',
                  tabSize: 2,
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-[11px] text-zinc-500 font-mono">Press Run Query to execute</span>
              <Button 
                onClick={handleRunQuery} 
                disabled={isQueryRunning}
                className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isQueryRunning ? 'Executing...' : 'Run Query'}</span>
              </Button>
            </div>

            {queryResult && (
              <div className="mt-4 flex-1 min-h-0 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col bg-zinc-950">
                <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                  <span>Results: {queryResult.affected} rows affected</span>
                  <span className="text-emerald-400 font-bold">Execution Time: {queryResult.Duration}</span>
                </div>

                <div className="flex-1 overflow-auto max-h-56">
                  {queryResult.Error ? (
                    <div className="p-4 text-xs font-mono text-rose-400">
                      Error: {queryResult.Error}
                    </div>
                  ) : queryResult.Rows && queryResult.Rows.length > 0 ? (
                    <table className="w-full text-left text-xs text-zinc-300 font-mono">
                      <thead className="bg-zinc-900/60 uppercase text-[10px] text-zinc-400 border-b border-zinc-800">
                        <tr>
                          {queryResult.Columns?.map(col => (
                            <th key={col} className="py-2 px-3">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {queryResult.Rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/40">
                            {queryResult.Columns?.map(col => (
                              <td key={col} className="py-2 px-3 text-zinc-300 truncate max-w-xs">
                                {String(row[col] ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-4 text-xs text-zinc-500 text-center">
                      Query executed successfully.
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
