import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';

// Counts smoothly to `value` whenever it changes (stats that refresh live stay readable).
export default function AnimatedNumber({ value, decimals = 0, format, className }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    const target = Number(value) || 0;
    if (!node || !inView) return undefined;
    const render = (v) => {
      node.textContent = format ? format(v) : v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };
    if (reduce) {
      render(target);
      prev.current = target;
      return undefined;
    }
    const controls = animate(prev.current, target, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: render,
    });
    prev.current = target;
    return () => controls.stop();
  }, [value, inView, reduce, decimals, format]);

  return <span ref={ref} className={className}>0</span>;
}
