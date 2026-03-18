import { Link, NavLink } from 'react-router-dom'
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const items = [
  { to: '/', label: 'Dashboard' },
  { to: '/pesees', label: 'Pesees' },
  { to: '/fournisseurs', label: 'Fournisseurs' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/paiements', label: 'Paiements' },
  { to: '/admin', label: 'Admin' },
]

export function Sidebar() {
  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="px-2 py-1 text-sm font-bold tracking-wide">
          PI Gestion
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton render={<NavLink to={item.to} />}>
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 text-xs text-muted-foreground">
        v0.1
      </SidebarFooter>
    </SidebarRoot>
  )
}
