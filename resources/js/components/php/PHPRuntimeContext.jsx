import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Shared state for the PHP section: the version list, which version the pages act on
// (kept in ?v= so links and reloads keep it), and the live install/remove task.

const PHPRuntimeContext = createContext(null);
const STORAGE_KEY = 'akpanel.php.version';

export function usePHPRuntime() {
  const ctx = useContext(PHPRuntimeContext);
  if (!ctx) throw new Error('usePHPRuntime must be used inside PHPRuntimeProvider');
  return ctx;
}

const byVersionDesc = (a, b) => b.version.localeCompare(a.version, undefined, { numeric: true });

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function PHPRuntimeProvider({ children }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const versionsQuery = useQuery({
    queryKey: ['php', 'versions'],
    queryFn: () => api.get('/api/php/versions'),
    staleTime: 10_000,
  });
  const all = useMemo(() => [...(versionsQuery.data?.data || [])].sort(byVersionDesc), [versionsQuery.data]);
  const installed = useMemo(() => all.filter((v) => v.is_installed), [all]);
  const cli = versionsQuery.data?.cli || {};
  const serverDefault = versionsQuery.data?.default || '';

  const requested = params.get('v') || '';
  const selectedVer = [requested, readStored(), serverDefault, installed[0]?.version]
    .find((v) => v && installed.some((i) => i.version === v)) || '';

  const setSelectedVer = useCallback((v) => {
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
    const next = new URLSearchParams(params);
    next.set('v', v);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const current = all.find((v) => v.version === selectedVer) || null;
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['php'] }), [qc]);

  // ---- live tasks (install / remove) ------------------------------------------------
  const [task, setTask] = useState(null);
  const pollRef = useRef(null);
  useEffect(() => () => clearInterval(pollRef.current), []);

  const pollTask = useCallback((id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/php/task/status?task_id=${encodeURIComponent(id)}`);
        setTask(res.data);
        if (res.data.status !== 'running') {
          clearInterval(pollRef.current);
          refresh();
          if (res.data.status === 'completed') toast.success(`${res.data.title}: done`);
          else toast.error(`${res.data.title}: failed — see the log`);
        }
      } catch {
        /* transient; keep polling */
      }
    }, 800);
  }, [refresh]);

  const openTask = useCallback((res) => {
    setTask({ id: res.task_id, title: res.title, status: 'running', progress: 5, logs: [] });
    pollTask(res.task_id);
  }, [pollTask]);

  // startInstall({ type: 'version' | 'extension' | 'addon' | 'ffmpeg', version, name, packages })
  const startInstall = useCallback(async ({ type, version, name = '', packages = [] }) => {
    try {
      openTask(await api.post('/api/php/install/live', { type, version, name, packages: packages.join(',') }));
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 12000 });
      return false;
    }
  }, [openTask]);

  const startUninstall = useCallback(async (version) => {
    try {
      openTask(await api.post('/api/php/uninstall', { version }));
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 12000 });
      return false;
    }
  }, [openTask]);

  const value = {
    navigate,
    versionsQuery, all, installed, cli, serverDefault,
    selectedVer, setSelectedVer, current, refresh,
    task, setTask, startInstall, startUninstall,
  };

  return <PHPRuntimeContext.Provider value={value}>{children}</PHPRuntimeContext.Provider>;
}

// fpmStatus maps a version row to a StatusBadge status.
export function fpmStatus(v) {
  if (!v?.is_installed) return 'inactive';
  return v.is_fpm_running ? 'running' : 'stopped';
}
