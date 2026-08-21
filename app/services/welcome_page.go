package services

import (
	"fmt"
	"html"
	"os"
	"path/filepath"
)

// WriteWelcomeIndex writes a premium AKpanel landing page when dest does not exist.
func WriteWelcomeIndex(dest, domain, username string) error {
	if dest == "" {
		return nil
	}
	if _, err := os.Stat(dest); err == nil {
		return nil
	}
	_ = os.MkdirAll(filepath.Dir(dest), 0755)
	return os.WriteFile(dest, []byte(WelcomeIndexPHP(domain, username)), 0644)
}

// WelcomeIndexPHP is the default site homepage: Tailwind welcome, no PHP/nginx versions.
func WelcomeIndexPHP(domain, username string) string {
	d := html.EscapeString(domain)
	u := html.EscapeString(username)
	title := d
	if title == "" {
		title = "AKpanel"
	}
	return fmt.Sprintf(`<?php
header('Content-Type: text/html; charset=UTF-8');
?><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>%s · AKpanel</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            ak: { ink: '#07080b', panel: '#0b1018', line: '#1e293b', mist: '#94a3b8', snow: '#f8fafc' }
          },
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
          }
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .ak-grid {
      background-image:
        linear-gradient(rgba(99,102,241,.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,.07) 1px, transparent 1px);
      background-size: 48px 48px;
    }
    .ak-glow {
      background: radial-gradient(ellipse 70%% 50%% at 50%% -10%%, rgba(99,102,241,.28), transparent 55%%),
                  radial-gradient(ellipse 40%% 40%% at 80%% 80%%, rgba(14,165,233,.12), transparent 50%%);
    }
  </style>
</head>
<body class="min-h-screen bg-ak-ink text-ak-snow ak-grid ak-glow antialiased">
  <main class="relative min-h-screen flex items-center justify-center px-4 py-16">
    <section class="w-full max-w-lg rounded-3xl border border-white/10 bg-ak-panel/80 backdrop-blur-xl shadow-[0_40px_80px_rgba(0,0,0,.55)] px-8 py-10 text-center">
      <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-400 shadow-lg shadow-indigo-500/30">
        <span class="text-lg font-extrabold tracking-tight text-white">AK</span>
      </div>
      <p class="mb-3 inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
        AKpanel
      </p>
      <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">Welcome</h1>
      <p class="mt-3 text-lg font-semibold text-indigo-200">%s is ready</p>
      <p class="mt-4 text-sm leading-relaxed text-ak-mist">
        This domain is hosted on <span class="text-white font-semibold">AKpanel</span>.
        Replace <code class="rounded-md bg-white/5 px-1.5 py-0.5 text-sky-200">index.php</code>
        when your website is ready to go live.
      </p>
      <div class="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
        <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p class="text-[10px] uppercase tracking-wider text-ak-mist">Account</p>
          <p class="mt-1 font-mono text-sm text-white">%s</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p class="text-[10px] uppercase tracking-wider text-ak-mist">Control panel</p>
          <p class="mt-1 text-sm font-semibold text-white">AKpanel</p>
        </div>
      </div>
      <p class="mt-8 text-[11px] text-slate-500">A premium hosting workspace · AKpanel</p>
    </section>
  </main>
</body>
</html>
`, title, d, u)
}
