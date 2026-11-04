// Shared motion presets. Durations are short and easing is calm: motion should explain
// changes (enter, reorder, expand), never decorate. Reduced-motion users get instant states
// through <MotionConfig reducedMotion="user"> in the app root.

export const ease = [0.22, 1, 0.36, 1];

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease } },
};

export const page = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const staggerContainer = (stagger = 0.04, delay = 0) => ({
  initial: {},
  animate: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease } },
};

export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
  transition: { type: 'spring', stiffness: 500, damping: 30 },
};

export const spring = { type: 'spring', stiffness: 420, damping: 34 };
