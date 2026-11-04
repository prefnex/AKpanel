// Flattened [{title, url, group, parent}] for search and breadcrumbs.
export function flattenNav(nav) {
  const out = [];
  for (const group of nav) {
    for (const item of group.items) {
      out.push({ title: item.title, url: item.url, group: group.label, icon: item.icon });
      for (const child of item.children || []) {
        out.push({ title: child.title, url: child.url, group: group.label, parent: item.title, icon: item.icon });
      }
    }
  }
  return out;
}
