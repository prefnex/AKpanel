import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MAP = {
  active: ['success', 'Active'],
  running: ['success', 'Running'],
  online: ['success', 'Online'],
  enabled: ['success', 'Enabled'],
  healthy: ['success', 'Healthy'],
  suspended: ['warning', 'Suspended'],
  pending: ['warning', 'Pending'],
  warning: ['warning', 'Warning'],
  stopped: ['muted', 'Stopped'],
  inactive: ['muted', 'Inactive'],
  disabled: ['muted', 'Disabled'],
  failed: ['danger', 'Failed'],
  error: ['danger', 'Error'],
  offline: ['danger', 'Offline'],
};

// Semantic status pill with a live dot for running states.
export default function StatusBadge({ status, label, className }) {
  const key = String(status || '').toLowerCase();
  const [variant, text] = MAP[key] || ['muted', status || 'Unknown'];
  const live = variant === 'success';
  return (
    <Badge variant={variant} className={cn('font-medium', className)}>
      <span className="relative flex h-1.5 w-1.5">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {label || text}
    </Badge>
  );
}
