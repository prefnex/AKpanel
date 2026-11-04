import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from './ThemeToggle';
import { ease } from '@/lib/motion';

/**
 * Shared sign-in screen for the admin and client panels.
 * onSubmit({username, password}) must resolve or throw an Error with a readable message.
 */
export default function AuthScreen({ title, subtitle, icon: Icon, usernameLabel = 'Username', usernamePlaceholder, defaultUsername = '', onSubmit, footer, aside }) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ username: username.trim(), password });
    } catch (err) {
      setError(err.message || 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative flex flex-col p-6 md:p-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {Icon ? <Icon className="h-4 w-4" /> : 'A'}
            </div>
            AKpanel
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease } }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{usernameLabel}</Label>
                <Input id="username" autoComplete="username" autoFocus={!defaultUsername} value={username}
                  placeholder={usernamePlaceholder} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus={!!defaultUsername}
                    value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <motion.p
                initial={false}
                animate={error ? { opacity: 1, height: 'auto', x: [0, -6, 6, -3, 3, 0] } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.35 }}
                className="overflow-hidden text-sm text-destructive"
                role="alert"
              >
                {error}
              </motion.p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Sign in
              </Button>
            </div>
            {footer}
          </motion.form>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-muted/40 lg:block">{aside}</div>
    </div>
  );
}
