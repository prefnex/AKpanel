import { motion } from 'motion/react';
import { fadeUp } from '@/lib/motion';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div {...fadeUp} className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}
