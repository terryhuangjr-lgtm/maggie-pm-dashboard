import { LayoutDashboard, Building2, ListTodo, Calendar, BookOpen, DollarSign, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'contacts', label: 'Contacts', icon: BookOpen },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    ...(isAdmin ? [{ id: 'reports', label: 'Reports', icon: DollarSign }] : []),
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>MH Group</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        {profile && (
          <div className="sidebar-role">
            <ShieldCheck size={12} />
            <span>{profile.role === 'admin' ? 'Admin' : 'Basic'}</span>
          </div>
        )}
        <button className="nav-item logout-btn" onClick={signOut}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
