import { Fragment, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, ChevronsUpDown, LogOut, KeyRound } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { flattenNav } from '@/lib/nav';
import { page } from '@/lib/motion';
import { CommandMenu, CommandTrigger } from './CommandMenu';
import ThemeToggle from './ThemeToggle';

function isActive(pathname, url) {
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}

function NavItem({ item, pathname, badge }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const active = isActive(pathname, item.url);
  const close = () => isMobile && setOpenMobile(false);

  if (!item.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <Link to={item.url} onClick={close}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
        {badge != null && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={active} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={active}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton asChild isActive={pathname === child.url}>
                  <Link to={child.url} onClick={close}>{child.title}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function Crumbs({ nav, pathname, rootLabel }) {
  const crumbs = useMemo(() => {
    const flat = flattenNav(nav);
    const exact = flat.find((p) => p.url === pathname)
      || [...flat].sort((a, b) => b.url.length - a.url.length).find((p) => p.url !== '/' && isActive(pathname, p.url));
    if (!exact || exact.url === '/') return [];
    const trail = [];
    if (exact.parent) {
      const parent = flat.find((p) => p.title === exact.parent && !p.parent);
      if (parent) trail.push(parent);
    }
    trail.push(exact);
    return trail;
  }, [nav, pathname]);

  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          {crumbs.length ? (
            <BreadcrumbLink asChild><Link to="/">{rootLabel}</Link></BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{rootLabel}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {crumbs.map((c, i) => (
          <Fragment key={c.url}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage>{c.title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild><Link to={c.url}>{c.title}</Link></BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * AppShell — shared layout for the admin and client panels.
 * brand: { name, subtitle, icon }; user: { name, detail }; badges: { [url]: number }.
 */
export default function AppShell({
  nav, brand, user, badges = {}, onLogout, onChangePassword, headerActions, sidebarFooter, children, fullBleed,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const initials = (user?.name || '?').slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" onClick={() => navigate('/')} className="gap-3">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  {brand.icon ? <brand.icon className="size-4" /> : <span className="text-sm font-bold">A</span>}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{brand.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{brand.subtitle}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {nav.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem key={item.url} item={item} pathname={pathname} badge={badges[item.url]} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          {sidebarFooter}
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.detail}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.detail}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {onChangePassword && (
                    <DropdownMenuItem onSelect={onChangePassword}><KeyRound className="mr-2 h-4 w-4" />Change password</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Crumbs nav={nav} pathname={pathname} rootLabel={brand.name} />
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden sm:block"><CommandTrigger /></div>
            {headerActions}
            <ThemeToggle />
          </div>
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            {...page}
            className={fullBleed ? 'min-h-0 flex-1' : 'mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8'}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </SidebarInset>

      <CommandMenu nav={nav} onLogout={onLogout} />
    </SidebarProvider>
  );
}
