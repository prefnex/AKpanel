import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/lib/motion';

// Right-hand panel on the sign-in screen: product points, no stock art.
export default function AuthAside({ heading, points }) {
  return (
    <div className="flex h-full flex-col justify-end p-10">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
      />
      <motion.div variants={staggerContainer(0.08, 0.15)} initial="initial" animate="animate" className="relative max-w-md space-y-6">
        <motion.h2 variants={staggerItem} className="text-xl font-semibold tracking-tight">{heading}</motion.h2>
        <ul className="space-y-4">
          {points.map((p) => (
            <motion.li key={p.title} variants={staggerItem} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
                <p.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
