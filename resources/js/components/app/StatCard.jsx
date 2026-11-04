import { motion } from 'motion/react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';
import AnimatedNumber from './AnimatedNumber';

const tones = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

// Compact metric tile: label, animated value, optional hint and usage bar.
export default function StatCard({ label, value, suffix, decimals = 0, hint, icon: Icon, percent, tone = 'default', loading, onClick }) {
  const autoTone = percent == null ? tone : percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : tone;
  return (
    <motion.div variants={staggerItem} whileHover={onClick ? { y: -2 } : undefined}>
      <Card
        onClick={onClick}
        className={cn('group relative overflow-hidden p-4 transition-colors', onClick && 'cursor-pointer hover:border-primary/40')}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <>
              <AnimatedNumber value={value} decimals={decimals} className="text-2xl font-semibold tabular" />
              {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </>
          )}
        </div>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        {percent != null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', tones[autoTone])}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        )}
      </Card>
    </motion.div>
  );
}
