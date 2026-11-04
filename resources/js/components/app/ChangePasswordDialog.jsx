import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

const schema = z.object({
  old_password: z.string().min(1, 'Enter your current password'),
  new_password: z.string().min(10, 'Use at least 10 characters'),
  confirm: z.string(),
}).refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function ChangePasswordDialog({ open, onOpenChange }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { old_password: '', new_password: '', confirm: '' } });
  const mutation = useMutation({
    mutationFn: (v) => api.post('/api/auth/password', { old_password: v.old_password, new_password: v.new_password }),
    onSuccess: (res) => {
      // The server revokes older sessions and hands back a fresh token for this browser.
      if (res?.token) localStorage.setItem('ak_token', res.token);
      toast.success('Password updated. Other sessions were signed out.');
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) form.reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change root password</DialogTitle>
          <DialogDescription>Also updates the Linux root password and signs out every other session.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            {[
              ['old_password', 'Current password', 'current-password'],
              ['new_password', 'New password', 'new-password'],
              ['confirm', 'Confirm new password', 'new-password'],
            ].map(([name, label, ac]) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl><Input type="password" autoComplete={ac} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}Update password
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
