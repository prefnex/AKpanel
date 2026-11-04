import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

// Pill-style tab switcher whose active indicator glides between options (shared layout animation).
export default function SegmentedControl({ value, onChange, options, className, size = 'sm' }) {
  const id = useId();
  return (
    <div role="tablist" className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {opt.icon && <opt.icon className="h-3.5 w-3.5" />}
              {opt.label}
              {opt.count != null && <span className="tabular text-muted-foreground">{opt.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
