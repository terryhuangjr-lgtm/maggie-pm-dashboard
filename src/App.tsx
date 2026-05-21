import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { PropertyList } from './components/PropertyList'
import { PropertyDetail } from './components/PropertyDetail'
import { TaskList } from './components/TaskList'
import { CalendarView } from './components/CalendarView'
import { ContactList } from './components/ContactList'
import { FinancialReports } from './components/FinancialReports'
import { LoginPage } from './components/LoginPage'
import { AuthProvider, useAuth } from './lib/AuthContext'
import './styles/index.css'

function AppContent() {
  const { user, loading } = useAuth()
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
