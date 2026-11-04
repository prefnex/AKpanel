import {
  LayoutDashboard, Globe, Network, Database, FolderTree, Server, Mail, Clock, Code2, Archive,
} from 'lucide-react';

// Client portal navigation (sidebar, breadcrumbs, ⌘K).
export const clientNav = [
  {
    label: 'Overview',
    items: [{ title: 'Dashboard', url: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Websites',
    items: [
      { title: 'Domains', url: '/websites', icon: Globe },
      { title: 'DNS records', url: '/dns', icon: Network },
      { title: 'PHP settings', url: '/php', icon: Code2 },
    ],
  },
  {
    label: 'Data',
    items: [
      { title: 'Databases', url: '/databases', icon: Database },
      { title: 'File manager', url: '/files', icon: FolderTree },
      { title: 'FTP accounts', url: '/ftp', icon: Server },
      { title: 'Backups', url: '/backups', icon: Archive },
    ],
  },
  {
    label: 'Mail & tasks',
    items: [
      { title: 'Email accounts', url: '/emails', icon: Mail },
      { title: 'Cron jobs', url: '/cron', icon: Clock },
    ],
  },
];
