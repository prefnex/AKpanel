import { motion } from 'motion/react';
import { fadeUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

// Standard page heading: title, one-line description, and right-aligned actions.
export default function PageHeader({ title, description, actions, children, className }) {
  return (
    <motion.div
      {...fadeUp}
      className={cn('flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
