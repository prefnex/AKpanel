import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, LogOut, Monitor, Moon, Search, Sun } from 'lucide-react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { flattenNav } from '@/lib/nav';

// ⌘K / Ctrl+K palette: jump to any page or run a shell action.
export function CommandMenu({ nav, actions = [], onLogout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const pages = useMemo(() => flattenNav(nav), [nav]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('akpanel:command', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('akpanel:command', onOpen);
    };
  }, []);

  const run = (fn) => {
    setOpen(false);
    fn();
  };

  const groups = pages.reduce((acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((a) => (
              <CommandItem key={a.label} onSelect={() => run(a.run)}>
                {a.icon && <a.icon className="mr-2 h-4 w-4" />}
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Object.entries(groups).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((p) => (
              <CommandItem key={p.url} value={`${p.parent || ''} ${p.title} ${p.url}`} onSelect={() => run(() => navigate(p.url))}>
                {p.icon && <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                <span>{p.parent ? <span className="text-muted-foreground">{p.parent} / </span> : null}{p.title}</span>
                <CommandShortcut><CornerDownLeft className="h-3 w-3" /></CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem onSelect={() => run(() => setTheme('light'))}><Sun className="mr-2 h-4 w-4" />Light theme</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('dark'))}><Moon className="mr-2 h-4 w-4" />Dark theme</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('system'))}><Monitor className="mr-2 h-4 w-4" />System theme</CommandItem>
          {onLogout && <CommandItem onSelect={() => run(onLogout)}><LogOut className="mr-2 h-4 w-4" />Sign out</CommandItem>}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandTrigger() {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  return (
    <Button
      variant="outline"
      onClick={() => window.dispatchEvent(new Event('akpanel:command'))}
      className="h-8 w-full justify-start gap-2 px-2.5 text-muted-foreground shadow-none sm:w-56 md:w-64"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="flex-1 text-left text-xs font-normal">Search…</span>
      <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
    </Button>
  );
}
