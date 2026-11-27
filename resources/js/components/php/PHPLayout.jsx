import React from 'react';
import { Outlet } from 'react-router-dom';
import { PHPRuntimeProvider } from './PHPRuntimeContext';
import { TaskDialog } from './PHPShared';

export default function PHPLayout() {
  return (
    <PHPRuntimeProvider>
      <Outlet />
      <TaskDialog />
    </PHPRuntimeProvider>
  );
}
