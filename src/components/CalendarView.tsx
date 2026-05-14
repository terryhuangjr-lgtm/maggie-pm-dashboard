import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar as CalendarIcon, Clock, DollarSign, AlertTriangle } from 'lucide-react'

interface CalendarEvent {
  date: string
  label: string
  type: 'lease_expiry' | 'rent_due' | 'task_due' | 'inspection'
  property: string
  details?: string
}

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const calEvents: CalendarEvent[] = []

      // Lease expirations
      const { data: expirations } = await supabase
        .from('upcoming_lease_expirations')
        .select('*')
        .order('lease_end', { ascending: true })
      
      if (expirations) {
        for (const e of expirations) {
          calEvents.push({
            date: e.lease_end,
            label: `Lease expires — ${e.tenant_name}`,
            type: 'lease_expiry',
            property: `${e.address}${e.unit_number ? ` ${e.unit_number}` : ''}`,
            details: `$${Number(e.monthly_rent).toLocaleString()}/mo, owner: ${e.owner_name}`
          })
        }
      }

      // Rent due dates from active leases
      const { data: activeLeases } = await supabase
        .from('leases')
        .select('*, properties(address, unit_number), tenants(first_name, last_name)')
        .eq('status', 'active')
      
      if (activeLeases) {
        const now = new Date()
        for (let m = 0; m < 3; m++) {
          const month = new Date(now.getFullYear(), now.getMonth() + m, 1)
          for (const l of activeLeases) {
            const prop = l.properties as any
            const ten = l.tenants as any
            const dueDay = l.rent_due_day || 1
            const dueDate = new Date(month.getFullYear(), month.getMonth(), Math.min(dueDay, 28))
            calEvents.push({
              date: dueDate.toISOString().split('T')[0],
              label: `Rent due — ${ten ? `${ten.first_name} ${ten.last_name}` : 'Unknown'}`,
              type: 'rent_due',
              property: `${prop?.address || ''}${prop?.unit_number ? ` ${prop.unit_number}` : ''}`,
              details: `$${Number(l.monthly_rent).toLocaleString()}`
            })
          }
        }
      }

      // Tasks with due dates
      const { data: tasks } = await supabase
        .from('open_tasks_by_priority')
        .select('*')
        .not('due_date', 'is', null)
      
      if (tasks) {
        for (const t of tasks) {
          calEvents.push({
            date: t.due_date,
            label: t.title,
            type: t.task_type === 'inspection' ? 'inspection' : 'task_due',
            property: t.address || '—',
            details: `Priority: ${t.priority}`
          })
        }
      }

      setEvents(calEvents.sort((a, b) => a.date.localeCompare(b.date)))
    } catch (err) {
      console.error('Failed to load calendar events:', err)
    } finally {
      setLoading(false)
    }
  }

  const getEventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr)

  // Generate calendar grid
  const [year, month] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date().toISOString().split('T')[0]

  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const eventIcons: Record<string, React.ReactNode> = {
    lease_expiry: <CalendarIcon size={14} />,
    rent_due: <DollarSign size={14} />,
    task_due: <Clock size={14} />,
    inspection: <AlertTriangle size={14} />
  }

  if (loading) return <div className="loading-state"><CalendarIcon /> <p>Loading calendar...</p></div>

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Lease expirations, rent due dates, inspections, and tasks</p>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Calendar Grid */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-header">
            <h3>{monthNames[month - 1]} {year}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="filter-btn" onClick={() => {
                const d = new Date(year, month - 2, 1)
                setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
              }}>← Prev</button>
              <button className="filter-btn" onClick={() => {
                const d = new Date(year, month, 1)
                setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
              }}>Next →</button>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {dayNames.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', padding: '8px 0' }}>
                  {d}
                </div>
              ))}
              {days.map((d, i) => {
                if (d === null) return <div key={`empty-${i}`} />
                const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`
                const dayEvents = getEventsForDate(dateStr)
                const isToday = dateStr === today
                return (
                  <div
                    key={dateStr}
                    style={{
                      minHeight: 80,
                      background: isToday ? 'var(--accent-light)' : 'transparent',
                      border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                      marginBottom: 4
                    }}>
                      {d}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayEvents.slice(0, 3).map((ev, ei) => (
                        <div
                          key={ei}
                          style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: ev.type === 'lease_expiry' ? 'rgba(239, 68, 68, 0.15)' :
                                        ev.type === 'rent_due' ? 'rgba(16, 185, 129, 0.15)' :
                                        ev.type === 'inspection' ? 'rgba(139, 92, 246, 0.15)' :
                                        'rgba(59, 130, 246, 0.15)',
                            color: ev.type === 'lease_expiry' ? 'var(--red)' :
                                   ev.type === 'rent_due' ? 'var(--green)' :
                                   ev.type === 'inspection' ? 'var(--purple)' :
                                   'var(--blue)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={`${ev.label} — ${ev.property}`}
                        >
                          {ev.label.substring(0, 15)}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="card" style={{ width: 320, flexShrink: 0, maxHeight: 600, overflow: 'auto' }}>
          <div className="card-header"><h3>Upcoming Events</h3></div>
          <div className="card-body">
            {events.length === 0 ? (
              <div className="empty-state"><CalendarIcon /> <p>No upcoming events</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {events.slice(0, 20).map((ev, i) => {
                  const eventDate = new Date(ev.date)
                  const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: ev.type === 'lease_expiry' ? 'var(--red)' : ev.type === 'rent_due' ? 'var(--green)' : 'var(--blue)' }}>
                          {eventIcons[ev.type]}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{ev.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                        {ev.property}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                        <span>{eventDate.toLocaleDateString()}</span>
                        <span style={{
                          color: daysUntil <= 0 ? 'var(--red)' : daysUntil <= 7 ? 'var(--yellow)' : 'var(--text-muted)',
                          fontWeight: daysUntil <= 7 ? 600 : 400
                        }}>
                          {daysUntil <= 0 ? 'Overdue' : `${daysUntil} days`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
