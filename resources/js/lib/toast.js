import { toast } from 'sonner';

// Adapter for legacy pages that call showToast(message, 'success' | 'error' | 'info' | 'warning').
export function showToast(message, type = 'success') {
  const fn = { error: toast.error, info: toast.info, warning: toast.warning }[type] || toast.success;
  fn(message);
}
