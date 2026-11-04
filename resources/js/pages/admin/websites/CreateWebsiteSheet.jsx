import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import SegmentedControl from '@/components/app/SegmentedControl';
import { useInstalledPHPVersions } from '@/hooks/usePHPVersions';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const domainRe = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

const schema = z.object({
  domain: z.string().trim().toLowerCase().regex(domainRe, 'Enter a valid domain, e.g. example.com'),
  server_engine: z.enum(['nginx', 'apache', 'hybrid']),
  template_id: z.string().min(1),
  site_type: z.string(),
  php_version: z.string(),
  proxy_port: z.coerce.number().int().min(1024, 'Use a port between 1024 and 65535').max(65535),
});

const ENGINES = [
  { value: 'nginx', label: 'Nginx' },
  { value: 'apache', label: 'Apache' },
  { value: 'hybrid', label: 'Nginx + Apache' },
];

export default function CreateWebsiteSheet({ open, onOpenChange, presetTemplate }) {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/api/templates').then((r) => r.data || []),
    staleTime: Infinity,
  });
  const php = useInstalledPHPVersions();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { domain: '', server_engine: 'nginx', template_id: 'laravel', site_type: 'php', php_version: '8.2', proxy_port: 3000 },
  });
  const siteType = form.watch('site_type');
  const templateId = form.watch('template_id');

  const pickTemplate = (tpl) => {
    form.setValue('template_id', tpl.id);
    form.setValue('site_type', tpl.default_type);
    if (tpl.php_version && tpl.php_version !== 'none') form.setValue('php_version', tpl.php_version);
  };

  useEffect(() => {
    if (!open) return;
    form.reset();
    const tpl = presetTemplate && (templates.data || []).find((t) => t.id === presetTemplate);
    if (tpl) pickTemplate(tpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetTemplate, templates.data]);

  useEffect(() => {
    const versions = php.data || [];
    if (versions.length && !versions.includes(form.getValues('php_version'))) {
      form.setValue('php_version', versions[0]);
    }
  }, [php.data, form]);

  const create = useMutation({
    mutationFn: (v) => api.post('/api/websites', v),
    onSuccess: (res, v) => {
      toast.success(res?.message || `${v.domain} is live`);
      qc.invalidateQueries({ queryKey: ['websites'] });
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <SheetTitle>New website</SheetTitle>
          <SheetDescription>Creates the vhost for the active web server profile, the document root and a DNS zone.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-6 p-6">
                <FormField control={form.control} name="domain" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <FormControl><Input placeholder="example.com" autoFocus autoComplete="off" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="server_engine" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Web server</FormLabel>
                    <div><SegmentedControl size="md" value={field.value} onChange={field.onChange} options={ENGINES} /></div>
                    <FormDescription>Nginx + Apache serves static files from Nginx and passes PHP/.htaccess to Apache.</FormDescription>
                  </FormItem>
                )} />

                <div className="space-y-2">
                  <Label>Application template</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(templates.data || []).map((tpl) => {
                      const active = templateId === tpl.id;
                      return (
                        <motion.button
                          type="button"
                          key={tpl.id}
                          onClick={() => pickTemplate(tpl)}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'relative rounded-lg border p-3 text-left transition-colors',
                            active ? 'border-primary bg-primary/5' : 'hover:border-foreground/20 hover:bg-muted/50'
                          )}
                        >
                          {active && (
                            <motion.span layoutId="tpl-check" className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </motion.span>
                          )}
                          <p className="pr-5 text-sm font-medium leading-tight">{tpl.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{tpl.category}</p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {siteType === 'php' && (
                  <FormField control={form.control} name="php_version" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PHP version</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a version" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(php.data || [field.value]).map((v) => <SelectItem key={v} value={v}>PHP {v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {siteType === 'proxy' && (
                  <FormField control={form.control} name="proxy_port" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application port</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Requests are proxied to 127.0.0.1 on this port.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </ScrollArea>
            <SheetFooter className="border-t p-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}Create website
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
