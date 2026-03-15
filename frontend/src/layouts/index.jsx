import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Topbar  from '../components/common/Topbar'
import { NotificationProvider } from '../contexts/NotificationContext'
import cecbLogo from '../assets/cecb-logo.svg'

// ─────────────────────────────────────────────────────────────
//  AppLayout — authenticated pages with sidebar + topbar
// ─────────────────────────────────────────────────────────────
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <NotificationProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(p => !p)}
        />

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar onMenuToggle={() => setCollapsed(p => !p)} />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  )
}

// ─────────────────────────────────────────────────────────────
//  AuthLayout — centered card for login page
// ─────────────────────────────────────────────────────────────
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-eco-700
                    flex items-center justify-center p-4">
      <Outlet />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  PublicLayout — citizen portal, no sidebar, minimal header
// ─────────────────────────────────────────────────────────────
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal public header */}
      <header className="bg-primary-700 text-white px-6 py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/12 p-1">
            <img src={cecbLogo} alt="CECB" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-semibold text-sm">PrithviNet</p>
            <p className="text-primary-300 text-xs">Chattisgarh Environment Conservation Board</p>
          </div>
        </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <nav className="flex flex-wrap gap-2 text-sm">
              <PublicNavLink to="/public">Citizen Portal</PublicNavLink>
              <PublicNavLink to="/register">Register Industry</PublicNavLink>
              <PublicNavLink to="/register/status">Application Status</PublicNavLink>
            </nav>
            <span className="text-xs bg-eco-600 text-white px-2 py-1 rounded-full w-fit">
              Public Portal
            </span>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-200 mt-8">
        © {new Date().getFullYear()} Environment Department, Chhattisgarh Government &nbsp;|&nbsp; PrithviNet v1.0
      </footer>
    </div>
  )
}

function PublicNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (
        `rounded-full px-3 py-2 transition ${isActive ? 'bg-white text-primary-700' : 'bg-white/10 text-white hover:bg-white/20'}`
      )}
    >
      {children}
    </NavLink>
  )
}
