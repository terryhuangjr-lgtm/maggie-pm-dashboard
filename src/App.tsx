import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { PropertyList } from './components/PropertyList'
import { PropertyDetail } from './components/PropertyDetail'
import { TaskList } from './components/TaskList'
import { CalendarView } from './components/CalendarView'
import { ContactList } from './components/ContactList'
import { FinancialReports } from './components/FinancialReports'
import { ManagerDashboard } from './components/ManagerDashboard'
import { HelpGuide } from './components/HelpGuide'
import { LoginPage } from './components/LoginPage'
import { AuthProvider, useAuth } from './lib/AuthContext'
import './styles/index.css'

function AppContent() {
  const { user, loading, showInactivityWarning, dismissInactivityWarning } = useAuth()
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)

  const handleViewProperty = (id: string) => {
    setSelectedPropertyId(id)
    setActiveView('property-detail')
  }

  const handleBackToProperties = () => {
    setSelectedPropertyId(null)
    setActiveView('properties')
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="app-layout">
      {showInactivityWarning && (
        <div className="inactivity-warning">
          <span>Your session will expire in 1 minute due to inactivity.</span>
          <button onClick={dismissInactivityWarning} className="btn btn-small">
            Stay Signed In
          </button>
        </div>
      )}
      <Sidebar activeView={activeView} onNavigate={(v) => {
        setActiveView(v)
        setSelectedPropertyId(null)
      }} />
      <main className="main-content">
        {activeView === 'dashboard' && <Dashboard onViewProperty={handleViewProperty} />}
        {activeView === 'properties' && <PropertyList onViewProperty={handleViewProperty} />}
        {activeView === 'property-detail' && selectedPropertyId && (
          <PropertyDetail propertyId={selectedPropertyId} onBack={handleBackToProperties} />
        )}
        {activeView === 'tasks' && <TaskList />}
        {activeView === 'calendar' && <CalendarView />}
        {activeView === 'contacts' && <ContactList />}
        {activeView === 'reports' && <FinancialReports />}
        {activeView === 'manager' && <ManagerDashboard />}
        {activeView === 'help' && <HelpGuide />}
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
