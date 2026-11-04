import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Confirmation for destructive actions. Pass `confirmText` to require typing it (e.g. a username).
export default function ConfirmDialog({
  trigger,
  title,
  description,
  actionLabel = 'Confirm',
  destructive = true,
  confirmText,
  onConfirm,
  open,
  onOpenChange,
}) {
  const [typed, setTyped] = useState('');
  const blocked = confirmText && typed !== confirmText;
  return (
    <AlertDialog open={open} onOpenChange={(v) => { setTyped(''); onOpenChange?.(v); }}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {confirmText && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{confirmText}</span> to continue.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            onClick={onConfirm}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
