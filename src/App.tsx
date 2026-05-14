import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { PropertyList } from './components/PropertyList'
import { PropertyDetail } from './components/PropertyDetail'
import { TaskList } from './components/TaskList'
import { CalendarView } from './components/CalendarView'
import './styles/index.css'

function App() {
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
      </main>
    </div>
  )
}

export default App
