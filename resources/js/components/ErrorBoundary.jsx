import React from 'react';
import { ShieldAlert, RefreshCw, Copy, Check, Home, Bug } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Render Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleCopy = () => {
    const text = `${this.state.error?.toString()}\n\nStack:\n${this.state.error?.stack}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6 font-sans">
          <Card className="max-w-2xl w-full bg-zinc-950 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Application Render Error</h1>
                <p className="text-xs text-zinc-400 mt-0.5">An unexpected component error occurred during UI rendering.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-black/90 border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-rose-300 space-y-2 overflow-x-auto max-h-60 custom-scrollbar">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <Bug className="w-3.5 h-3.5" />
                  <span>{this.state.error.name}: {this.state.error.message}</span>
                </div>
                {this.state.error.stack && (
                  <pre className="text-[11px] text-zinc-500 whitespace-pre-wrap leading-relaxed">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap relative z-10">
              <div className="flex items-center gap-2">
                <Button
                  onClick={this.handleReload}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-lg shadow-rose-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Application</span>
                </Button>

                <Button
                  onClick={this.handleCopy}
                  variant="outline"
                  className="border-zinc-800 bg-zinc-900 text-zinc-300 text-xs h-10 px-4 rounded-xl gap-2 hover:bg-zinc-800"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{this.state.copied ? 'Error Copied' : 'Copy Error Details'}</span>
                </Button>
              </div>

              <Button
                onClick={this.handleReset}
                variant="ghost"
                className="text-zinc-500 hover:text-zinc-300 text-xs h-10"
              >
                Clear Local Cache & Reset
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
