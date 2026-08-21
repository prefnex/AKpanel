import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export const DEFAULT_INSTALL_PACKAGES = [
  { id: 'cli', label: 'CLI binary', on: true },
  { id: 'fpm', label: 'PHP-FPM daemon', on: true },
  { id: 'common', label: 'Common modules', on: true },
  { id: 'mysql', label: 'MySQL / MariaDB', on: true },
  { id: 'curl', label: 'cURL', on: true },
  { id: 'mbstring', label: 'mbstring', on: true },
  { id: 'xml', label: 'XML', on: true },
  { id: 'zip', label: 'Zip', on: true },
  { id: 'gd', label: 'GD graphics', on: true },
  { id: 'sqlite3', label: 'SQLite', on: true },
  { id: 'intl', label: 'Intl', on: false },
  { id: 'bcmath', label: 'BCMath', on: false },
  { id: 'soap', label: 'SOAP', on: false },
  { id: 'redis', label: 'Redis', on: false },
  { id: 'imagick', label: 'Imagick', on: false },
  { id: 'opcache', label: 'OPcache', on: true },
];

const PHPRuntimeContext = createContext(null);

export function usePHPRuntime() {
  const ctx = useContext(PHPRuntimeContext);
  if (!ctx) throw new Error('usePHPRuntime must be used inside PHPRuntimeProvider');
  return ctx;
}

export function PHPRuntimeProvider({ showToast, children }) {
  const navigate = useNavigate();
  const params = useParams();
  const installVersion = params.version || '';

  const [installPkgs, setInstallPkgs] = useState(DEFAULT_INSTALL_PACKAGES);
  const [phpDetails, setPhpDetails] = useState([]);
  const [cliOverview, setCliOverview] = useState({ default_version: '', binary_path: '', version_line: '' });
  const [selectedVer, setSelectedVer] = useState('');
  const [settingDefaultCLI, setSettingDefaultCLI] = useState(false);
  const [settingDefaultFPM, setSettingDefaultFPM] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [phpInfoSections, setPhpInfoSections] = useState([]);
  const [infoFilter, setInfoFilter] = useState('');
  const [rawIni, setRawIni] = useState('');
  const [fpmPool, setFpmPool] = useState({
    version: '8.3', pm: 'dynamic', max_children: '50',
    start_servers: '5', min_spare_servers: '5', max_spare_servers: '35', max_requests: '500',
  });
  const [previewItem, setPreviewItem] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const taskPollRef = useRef(null);
  const logEndRef = useRef(null);
  const [iniForm, setIniForm] = useState({
    memory_limit: '512M', upload_max_filesize: '128M', post_max_size: '128M',
    max_execution_time: '300', max_input_vars: '3000',
  });

  const fetchPHPDetails = async () => {
    try {
      const res = await fetch('/api/php/versions');
      if (!res.ok) return;
      const json = await res.json();
      const versions = json.data || [];
      setPhpDetails(versions);
      if (json.cli) setCliOverview(json.cli);
      const installed = versions.filter(v => v.is_installed);
      const def = versions.find(v => v.is_default_cli) || installed[0];
      setSelectedVer(prev => {
        if (installVersion) return installVersion;
        if (prev && installed.some(v => v.version === prev)) return prev;
        return def ? def.version : '';
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPHPInfo = async (ver) => {
    if (!ver) return;
    const res = await fetch(`/api/php/info?version=${ver}`);
    if (res.ok) {
      const json = await res.json();
      setPhpInfoSections(json.data || []);
    }
  };

  const fetchRawIni = async (ver) => {
    if (!ver) return;
    const res = await fetch(`/api/php/ini/raw?version=${ver}`);
    if (res.ok) {
      const json = await res.json();
      setRawIni(json.content || '');
    }
  };

  const fetchFpmPool = async (ver) => {
    if (!ver) return;
    const res = await fetch(`/api/php/fpm/pool?version=${ver}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data) setFpmPool(json.data);
    }
  };

  useEffect(() => { fetchPHPDetails(); }, []);

  useEffect(() => {
    if (!selectedVer) return;
    const current = phpDetails.find(v => v.version === selectedVer);
    if (current && current.is_installed) {
      setIniForm({
        memory_limit: current.memory_limit || '512M',
        upload_max_filesize: current.upload_max_filesize || '128M',
        post_max_size: current.post_max_size || '128M',
        max_execution_time: current.max_execution_time || '300',
        max_input_vars: current.max_input_vars || '3000',
      });
    }
  }, [selectedVer, phpDetails]);

  const startPollingTask = (taskId) => {
    if (taskPollRef.current) clearInterval(taskPollRef.current);
    taskPollRef.current = setInterval(async () => {
      const res = await fetch(`/api/php/task/status?task_id=${taskId}`);
      if (!res.ok) return;
      const json = await res.json();
      setActiveTask(json.data);
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (json.data.status === 'completed' || json.data.status === 'failed') {
        clearInterval(taskPollRef.current);
        fetchPHPDetails();
      }
    }, 600);
  };

  const handleStartLiveInstall = async (type, name = '', version = selectedVer) => {
    setPreviewItem(null);
    try {
      const res = await fetch('/api/php/install/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, name, version,
          packages: type === 'version' ? installPkgs.filter(p => p.on).map(p => p.id).join(',') : '',
        }),
      });
      const json = await res.json();
      if (res.ok && json.task_id) {
        setActiveTask({
          id: json.task_id, title: json.title, status: 'running', progress: 15,
          logs: [`Initializing installation: ${json.title}...`],
        });
        startPollingTask(json.task_id);
      }
    } catch (err) {
      showToast('Failed to start installation task', 'error');
    }
  };

  const handleSaveRawIni = async () => {
    try {
      const res = await fetch('/api/php/ini/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVer, content: rawIni }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveFpmPool = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/php/fpm/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fpmPool, version: selectedVer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSimpleIni = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/php/ini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVer, ...iniForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchPHPDetails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSetDefaultCLI = async (version) => {
    const ver = version || selectedVer;
    if (!ver) return;
    setSettingDefaultCLI(true);
    try {
      const res = await fetch('/api/php/cli/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: ver }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      if (json.cli) setCliOverview(json.cli);
      showToast(json.message || `Default CLI set to PHP ${ver}`);
      fetchPHPDetails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSettingDefaultCLI(false);
    }
  };

  const handleSetDefaultFPM = async (version) => {
    const ver = version || selectedVer;
    if (!ver) return;
    setSettingDefaultFPM(true);
    try {
      const res = await fetch('/api/php/fpm/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: ver }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message || `Default FPM set to PHP ${ver}`);
      fetchPHPDetails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSettingDefaultFPM(false);
    }
  };

  const handleRestartFPM = async () => {
    try {
      const res = await fetch('/api/php/fpm/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchPHPDetails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const currentDetail = phpDetails.find(v => v.version === selectedVer) || {
    version: selectedVer, is_installed: false, extensions: [],
  };
  const installedVersions = phpDetails.filter(v => v.is_installed);
  const availableVersions = phpDetails.filter(v => !v.is_installed);
  const categories = ['All', 'Performance', 'Database & Cache', 'Images & Media', 'Core & String', 'Network & Web', 'Archives', 'XML & Formats', 'Math & Security', 'Debugging', 'Concurrency'];
  const filteredExtensions = (currentDetail.extensions || []).filter(ext => {
    const name = ext.name || '';
    const desc = ext.description || '';
    const cat = ext.category || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'All' || cat === activeCategory;
    return matchesSearch && matchesCat;
  });
  const installedCount = (currentDetail.extensions || []).filter(e => e.is_installed).length;

  const value = {
    showToast, navigate, installVersion,
    installPkgs, setInstallPkgs,
    phpDetails, cliOverview, selectedVer, setSelectedVer,
    settingDefaultCLI, settingDefaultFPM, searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    phpInfoSections, infoFilter, setInfoFilter,
    rawIni, setRawIni, fpmPool, setFpmPool,
    previewItem, setPreviewItem, activeTask, setActiveTask, logEndRef,
    iniForm, setIniForm,
    fetchPHPDetails, fetchPHPInfo, fetchRawIni, fetchFpmPool,
    handleStartLiveInstall, handleSaveRawIni, handleSaveFpmPool,
    handleSaveSimpleIni, handleSetDefaultCLI, handleSetDefaultFPM, handleRestartFPM,
    currentDetail, installedVersions, availableVersions,
    categories, filteredExtensions, installedCount,
  };

  return (
    <PHPRuntimeContext.Provider value={value}>
      {children}
    </PHPRuntimeContext.Provider>
  );
}
