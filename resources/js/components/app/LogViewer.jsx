import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Monospace log panel that sticks to the bottom while new lines arrive,
// unless the user scrolled up to read.
export default function LogViewer({ text, className, emptyText = 'Waiting for output…' }) {
  const ref = useRef(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <pre
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={cn(
        'max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground',
        className
      )}
    >
      {text || emptyText}
    </pre>
  );
}
