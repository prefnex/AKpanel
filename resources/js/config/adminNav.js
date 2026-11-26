import {
  LayoutDashboard, Users, Package, Globe, Network, Mail, Server, ShieldCheck, Code2,
  Database, FolderTree, SquareTerminal, Flame, Settings, LayoutTemplate, GitBranch,
} from 'lucide-react';

// Single source of truth for admin navigation: sidebar, breadcrumbs and ⌘K palette.
export const adminNav = [
  {
    label: 'Overview',
    items: [{ title: 'Dashboard', url: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Accounts',
    items: [
      { title: 'Users', url: '/users', icon: Users },
      { title: 'Packages', url: '/packages', icon: Package },
    ],
  },
  {
    label: 'Hosting',
    items: [
      { title: 'Websites', url: '/websites', icon: Globe },
      { title: 'Subdomains', url: '/subdomains', icon: GitBranch },
      { title: 'Site templates', url: '/templates', icon: LayoutTemplate },
      {
        title: 'Web servers', url: '/webservers', icon: Server,
        children: [
          { title: 'Mode', url: '/webservers/select' },
          { title: 'Main config', url: '/webservers/main-conf' },
          { title: 'Domain config', url: '/webservers/domain-conf' },
          { title: 'Templates', url: '/webservers/templates' },
          { title: 'Conf editor', url: '/webservers/conf-editor' },
          { title: 'Status', url: '/webservers/status' },
          { title: 'Redirects', url: '/webservers/redirects' },
        ],
      },
      {
        title: 'PHP', url: '/php', icon: Code2,
        children: [
          { title: 'CLI version', url: '/php/cli' },
          { title: 'PHP-FPM', url: '/php/fpm' },
          { title: 'Default version', url: '/php/default' },
          { title: 'Extensions', url: '/php/extensions' },
          { title: 'Add-ons', url: '/php/addons' },
          { title: 'php.ini', url: '/php/ini' },
          { title: 'php.ini (raw)', url: '/php/ini-raw' },
          { title: 'Short info', url: '/php/short-info' },
          { title: 'phpinfo()', url: '/php/info' },
        ],
      },
      { title: 'SSL certificates', url: '/ssl', icon: ShieldCheck },
    ],
  },
  {
    label: 'Services',
    items: [
      {
        title: 'DNS', url: '/dns', icon: Network,
        children: [
          { title: 'Zones', url: '/dns/zones' },
          { title: 'BIND server', url: '/dns/server' },
          { title: 'Nameservers', url: '/dns/nameservers' },
          { title: 'Zone templates', url: '/dns/templates' },
          { title: 'Cluster', url: '/dns/cluster' },
          { title: 'DNSSEC', url: '/dns/security' },
        ],
      },
      {
        title: 'Email', url: '/emails', icon: Mail,
        children: [
          { title: 'Accounts', url: '/emails/accounts' },
          { title: 'Aliases', url: '/emails/aliases' },
          { title: 'Autoresponders', url: '/emails/autoresponders' },
          { title: 'Routing', url: '/emails/routing' },
          { title: 'Mail queue', url: '/emails/queue' },
          { title: 'Mail server', url: '/emails/server' },
          { title: 'DKIM & DNS', url: '/emails/dkim' },
          { title: 'Anti-spam', url: '/emails/antispam' },
        ],
      },
      {
        title: 'Databases', url: '/databases', icon: Database,
        children: [
          { title: 'MySQL / MariaDB', url: '/databases/mysql' },
          { title: 'PostgreSQL', url: '/databases/postgres' },
          { title: 'MongoDB', url: '/databases/mongodb' },
          { title: 'Redis', url: '/databases/redis' },
        ],
      },
    ],
  },
  {
    label: 'Server',
    items: [
      { title: 'File manager', url: '/filemanager', icon: FolderTree },
      { title: 'Terminal', url: '/terminal', icon: SquareTerminal },
      { title: 'Firewall', url: '/firewall', icon: Flame },
      { title: 'IP addresses', url: '/ips', icon: Network },
      { title: 'Server settings', url: '/settings/server', icon: Settings },
    ],
  },
];
