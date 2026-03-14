import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Building2, Factory, Ruler, AlertTriangle,
  MapPin, Users, UserCog, Wind, Droplets, Volume2, BarChart3,
  Map, TrendingUp, ShieldCheck, Globe, Ticket, ChevronDown,
  ChevronRight, LogOut, Settings,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../config/constants'
import clsx from 'clsx'
import cecbLogo from '../../assets/cecb-logo.svg'

// ─────────────────────────────────────────────────────────────
//  Navigation structure — role-filtered in the component
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.MONITORING_TEAM, ROLES.INDUSTRY_USER],
  },
  {
    label: 'Master Records',
    icon: Settings,
    roles: [ROLES.SUPER_ADMIN],
    children: [
      { label: 'Regional Offices', path: '/master/regional-offices',  icon: Building2 },
      { label: 'Industries',       path: '/master/industries',         icon: Factory },
      { label: 'Units',            path: '/master/units',              icon: Ruler },
      { label: 'Prescribed Limits',path: '/master/prescribed-limits',  icon: AlertTriangle },
      { label: 'Locations',        path: '/master/locations',          icon: MapPin },
      { label: 'Monitoring Team',  path: '/master/monitoring-team',    icon: Users },
      { label: 'User Management',  path: '/master/users',              icon: UserCog },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.MONITORING_TEAM, ROLES.INDUSTRY_USER],
    children: [
      { label: 'Air Monitoring',    path: '/reports/air',         icon: Wind },
      { label: 'Water Monitoring',  path: '/reports/water',       icon: Droplets },
      { label: 'Noise Monitoring',  path: '/reports/noise',       icon: Volume2 },
      { label: 'Comparison',        path: '/reports/comparison',  icon: BarChart3 },
      { label: 'Yearly Reports',    path: '/reports/yearly',      icon: TrendingUp },
    ],
  },
  {
    label: 'Compliance',
    icon: ShieldCheck,
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER],
    children: [
      { label: 'Non-Compliance Dashboard', path: '/compliance',            icon: ShieldCheck },
      { label: 'Violations',               path: '/compliance/violations', icon: AlertTriangle },
      { label: 'Escalations',              path: '/compliance/escalations',icon: TrendingUp },
      { label: 'Report Lock Status',       path: '/compliance/locks',      icon: Settings },
    ],
  },
  {
    label: 'Pollution Map',
    icon: Map,
    path: '/map',
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER],
  },
  {
    label: 'Forecast',
    icon: TrendingUp,
    path: '/forecast',
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER],
  },
  {
    label: 'Citizen Portal',
    icon: Globe,
    path: '/public',
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER],
    external: true,
  },
  {
    label: 'Support Tickets',
    icon: Ticket,
    path: '/settings/support',
    roles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_OFFICER, ROLES.MONITORING_TEAM, ROLES.INDUSTRY_USER],
  },
]

// ─────────────────────────────────────────────────────────────
//  Sidebar Component
// ─────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, onToggle }) {
  const { role, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [openGroups, setOpenGroups] = useState(['Master Records', 'Reports'])

  // Filter nav items by role
  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(role)
  )

  function toggleGroup(label) {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-primary-700 text-white transition-all duration-300',
      collapsed ? 'w-16' : 'w-[320px]'
    )}>
      {/* Logo */}
      <div className={clsx(
        'border-b border-primary-600',
        collapsed
          ? 'flex justify-center px-0 py-5'
          : 'flex items-center gap-4 px-5 py-5'
      )}>
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/12 p-1">
          <img src={cecbLogo} alt="CECB" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-base leading-tight">PrithviNet</p>
            <p className="text-primary-300 text-sm leading-tight">CECB</p>
          </div>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-5 py-4 border-b border-primary-600">
          <div className="rounded-2xl border border-primary-600 bg-primary-600/40 px-4 py-4">
            <p className="text-xs text-primary-300 uppercase tracking-wider mb-2">Logged in as</p>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold leading-tight text-white truncate">
                  {userProfile?.name ?? 'User'}
                </p>
                {userProfile?.roName && (
                  <p className="text-xs text-primary-200/90 mt-1 truncate">{userProfile.roName}</p>
                )}
              </div>
              <span className="inline-flex flex-shrink-0 items-center rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-medium text-white">
                {getRoleLabel(role)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={clsx(
        'flex-1 overflow-y-auto py-4 space-y-1',
        collapsed ? 'px-2' : 'px-3'
      )}>
        {visibleItems.map(item => {
          if (item.children) {
            const isOpen = openGroups.includes(item.label)
            const Icon = item.icon
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={clsx(
                    'w-full flex items-center rounded-xl text-primary-200 hover:bg-primary-600 hover:text-white transition-colors text-sm font-medium',
                    collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5'
                  )}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {isOpen
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />
                      }
                    </>
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="mt-1 ml-5 space-y-1">
                    {item.children.map(child => {
                      const ChildIcon = child.icon
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={({ isActive }) => clsx(
                            'flex items-center gap-3 px-4 py-2 rounded-xl text-xs transition-colors',
                            isActive
                              ? 'bg-primary-500 text-white font-medium'
                              : 'text-primary-300 hover:bg-primary-600 hover:text-white'
                          )}
                        >
                          <ChildIcon size={14} className="flex-shrink-0" />
                          <span>{child.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              target={item.external ? '_blank' : undefined}
              className={({ isActive }) => clsx(
                'flex items-center rounded-xl text-sm transition-colors',
                collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5',
                isActive
                  ? 'bg-eco-500 text-white font-medium'
                  : 'text-primary-200 hover:bg-primary-600 hover:text-white'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Logout */}
      <div className={clsx(
        'py-4 border-t border-primary-600',
        collapsed ? 'px-2' : 'px-3'
      )}>
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center rounded-xl text-primary-300 hover:bg-primary-600 hover:text-white transition-colors text-sm',
            collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5'
          )}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}

function getRoleLabel(role) {
  const labels = {
    superAdmin:      'Super Admin',
    regionalOfficer: 'Regional Officer',
    monitoringTeam:  'Monitoring Team',
    industryUser:    'Industry User',
  }
  return labels[role] ?? role
}
