import React from 'react';
import { Outlet } from 'react-router-dom';
import { PHPRuntimeProvider } from './PHPRuntimeContext';
import PHPPageShell from './PHPPageShell';

export default function PHPLayout({ showToast }) {
  return (
    <PHPRuntimeProvider showToast={showToast}>
      <div className="space-y-6">
        <PHPPageShell />
        <Outlet />
      </div>
    </PHPRuntimeProvider>
  );
}
