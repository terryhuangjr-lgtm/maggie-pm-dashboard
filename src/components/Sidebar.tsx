import { LayoutDashboard, Building2, ListTodo, Calendar } from 'lucide-react'

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
}

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
]

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>🏠</span>
        <span>Maggie PM</span>
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px' }}>
        Maggie Huang Real Estate
      </div>
    </aside>
  )
}
