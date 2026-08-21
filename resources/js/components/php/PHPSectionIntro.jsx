import React from 'react';

export default function PHPSectionIntro({ title, goal }) {
  return (
    <div className="mb-1">
      <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-3xl">{goal}</p>
    </div>
  );
}
