import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// One application template (or none) plus any number of feature templates from the library.
export default function TemplatePicker({ library = [], value = [], onChange, disabled, idPrefix = 'tpl', columns = 'sm:grid-cols-2' }) {
  const byName = useMemo(() => Object.fromEntries(library.map((t) => [t.name, t])), [library]);
  const apps = library.filter((t) => t.kind === 'app');
  const features = library.filter((t) => t.kind === 'feature');
  const app = value.find((n) => byName[n]?.kind === 'app') || 'none';
  const appInfo = app !== 'none' ? byName[app] : null;

  const setApp = (name) => onChange([...(name === 'none' ? [] : [name]), ...value.filter((n) => byName[n]?.kind !== 'app')]);
  const toggle = (name, on) => onChange(on ? [...new Set([...value, name])] : value.filter((n) => n !== name));

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-2">
        <Label>Application</Label>
        <Select value={app} onValueChange={setApp} disabled={disabled}>
          <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (generic PHP / static)</SelectItem>
            {apps.map((t) => <SelectItem key={t.name} value={t.name}>{t.title}{t.builtin ? '' : ' (custom)'}</SelectItem>)}
          </SelectContent>
        </Select>
        {appInfo && <p className="text-xs text-muted-foreground">{appInfo.description}</p>}
      </div>
      <div className="space-y-2">
        <Label>Features</Label>
        <div className={`grid gap-2 ${columns}`}>
          {features.map((t) => (
            <label key={t.name} htmlFor={`${idPrefix}-${t.name}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
              <Checkbox id={`${idPrefix}-${t.name}`} checked={value.includes(t.name)} onCheckedChange={(on) => toggle(t.name, !!on)} className="mt-0.5" disabled={disabled} />
              <span className="min-w-0 space-y-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {t.title}
                  {!t.builtin && <Badge variant="muted" className="px-1.5 text-[10px]">custom</Badge>}
                </span>
                <span className="block text-xs text-muted-foreground">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
