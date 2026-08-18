import React from 'react';
import { ArrowUpRight, TrendingUp, ChevronRight } from 'lucide-react';

export default function ChartsRow() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      
      {/* Card 1: Resource Allocation (Income Sources Style - 4 cols) */}
      <div className="lg:col-span-4 bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Process Resource Share</h3>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 hover:text-white transition cursor-pointer" />
          </div>

          <div className="mt-4">
            <span className="text-xs text-zinc-400">Total Allocated</span>
            <div className="text-2xl font-bold text-white font-mono tracking-tight mt-0.5">
              11,964 MB
            </div>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>Optimal memory distribution</span>
            </p>
          </div>

          {/* Segmented multi-color bar */}
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden flex gap-0.5 mt-4">
            <div className="bg-white h-full w-[38%]" />
            <div className="bg-zinc-400 h-full w-[30%]" />
            <div className="bg-zinc-600 h-full w-[20%]" />
            <div className="bg-zinc-700 h-full w-[12%]" />
          </div>

          {/* Breakdown items with dots */}
          <div className="mt-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span className="text-zinc-300">Nginx Edge Workers</span>
              </div>
              <span className="font-mono text-zinc-200 font-semibold">4,546 MB</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                <span className="text-zinc-300">PHP 8.2/8.3 Pools</span>
              </div>
              <span className="font-mono text-zinc-200 font-semibold">3,589 MB</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span className="text-zinc-300">Apache HTTP Backend</span>
              </div>
              <span className="font-mono text-zinc-200 font-semibold">2,392 MB</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-700" />
                <span className="text-zinc-300">Varnish Cache RAM</span>
              </div>
              <span className="font-mono text-zinc-200 font-semibold">1,437 MB</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center gap-2">
          <span>Active in-memory caching reduces SSD wear by 88%.</span>
        </div>
      </div>

      {/* Card 2: Server Request Throughput (Monthly Expenses Bar Chart Style - 4 cols) */}
      <div className="lg:col-span-4 bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Request Throughput</h3>
              <p className="text-[11px] text-zinc-500">Live request load (1h - 6h)</p>
            </div>
            <button className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-300 transition">
              View Report
            </button>
          </div>

          {/* Large Vertical Rounded Bars */}
          <div className="mt-8 flex items-end justify-between h-44 px-3">
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 bg-white rounded-t-xl h-24 hover:opacity-80 transition" />
              <span className="text-[10px] text-zinc-500 font-mono">1h</span>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 bg-white rounded-t-xl h-36 hover:opacity-80 transition" />
              <span className="text-[10px] text-zinc-500 font-mono">2h</span>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 bg-white rounded-t-xl h-20 hover:opacity-80 transition" />
              <span className="text-[10px] text-zinc-500 font-mono">3h</span>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 bg-white rounded-t-xl h-32 hover:opacity-80 transition" />
              <span className="text-[10px] text-zinc-500 font-mono">4h</span>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 bg-white rounded-t-xl h-28 hover:opacity-80 transition" />
              <span className="text-[10px] text-zinc-500 font-mono">5h</span>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 bg-white rounded-t-xl h-30 hover:opacity-80 transition" />
              <span className="text-[10px] text-zinc-500 font-mono">6h</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60">
          <p className="text-xs font-semibold text-white flex items-center gap-1">
            <span>Throughput up by 5.2% this hour</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Showing real-time epoll socket load.</p>
        </div>
      </div>

      {/* Card 3: Engine Traffic Share Donut (Summary Style - 4 cols) */}
      <div className="lg:col-span-4 bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Engine Traffic Share</h3>
              <p className="text-[11px] text-zinc-500">HTTP requests by subsystem</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-white" />
          </div>

          {/* SVG Donut Chart */}
          <div className="flex items-center justify-center my-4 relative">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background ring */}
              <path
                className="text-zinc-800"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Segment 1: Nginx (48%) */}
              <path
                className="text-white"
                strokeDasharray="48, 100"
                strokeWidth="4.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Segment 2: Varnish (32%) */}
              <path
                className="text-zinc-400"
                strokeDasharray="32, 100"
                strokeDashoffset="-48"
                strokeWidth="4.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Segment 3: Apache (13%) */}
              <path
                className="text-zinc-600"
                strokeDasharray="13, 100"
                strokeDashoffset="-80"
                strokeWidth="4.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-lg font-extrabold text-white font-mono">100%</span>
              <span className="text-[9px] text-zinc-500 font-semibold uppercase">Orchestrated</span>
            </div>
          </div>

          {/* 4 Legend Badges in 2x2 grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                <span className="text-zinc-300 truncate">Nginx Edge</span>
              </div>
              <span className="font-mono text-white font-bold ml-1">48%</span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                <span className="text-zinc-300 truncate">Varnish HIT</span>
              </div>
              <span className="font-mono text-white font-bold ml-1">32%</span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                <span className="text-zinc-300 truncate">Apache Dynamic</span>
              </div>
              <span className="font-mono text-white font-bold ml-1">13%</span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-zinc-700 shrink-0" />
                <span className="text-zinc-300 truncate">Static Epoll</span>
              </div>
              <span className="font-mono text-white font-bold ml-1">7%</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500">
          <span>Real-time traffic split across edge, cache, and origin.</span>
        </div>
      </div>

    </div>
  );
}
