import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar as CalendarIcon, Clock, DollarSign, AlertTriangle, Plus, X, MapPin, User } from 'lucide-react'

interface CalendarEvent {
  id?: string
  date: string
  label: string
  type: 'lease_expiry' | 'rent_due' | 'task_due' | 'inspection' | 'appointment' | 'meeting' | 'showing' | 'maintenance'
  property: string
  details?: string
  _custom?: boolean
  _gcalId?: string
  _gcalEvent?: any
}

interface CalendarEventDB {
  id: string
  property_id: string | null
  title: string
  description: string | null
  event_type: string
  event_date: string
  event_time: string | null
  duration_minutes: number
  location: string | null
  contact_name: string | null
  contact_phone: string | null
  status: string
  created_by: string
  created_at: string
}

interface Property {
  id: string
  address: string
  unit_number: string | null
}

const EVENT_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  lease_expiry: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--red)', dot: '#ef4444' },
  rent_due: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', dot: '#10b981' },
  task_due: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--blue)', dot: '#3b82f6' },
  inspection: { bg: 'rgba(139, 92, 246, 0.15)', color: 'var(--purple)', dot: '#8b5cf6' },
  appointment: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--yellow)', dot: '#f59e0b' },
  meeting: { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', dot: '#6366f1' },
  showing: { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', dot: '#ec4899' },
  maintenance: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', dot: '#f97316' }
}

type EventFormType = 'appointment' | 'meeting' | 'showing' | 'maintenance' | 'inspection'

const EVENT_TYPE_LABELS: Record<EventFormType, string> = {
  appointment: 'Appointment',
  meeting: 'Meeting',
  showing: 'Property Showing',
  maintenance: 'Maintenance',
  inspection: 'Inspection'
}

export function CalendarView() {
  const [editingEvent] = useState<any>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [dbEvents, setDbEvents] = useState<CalendarEventDB[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDB | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'appointment' as EventFormType,
    event_date: new Date().toISOString().split('T')[0],
    event_time: '09:00',
    duration_minutes: 60,
    property_id: '',
    location: '',
    contact_name: '',
    contact_phone: ''
  })

  function resetForm() {
    setFormData({
      title: '',
      description: '',
      event_type: 'appointment',
      event_date: new Date().toISOString().split('T')[0],
      event_time: '09:00',
      duration_minutes: 60,
      property_id: '',
      location: '',
      contact_name: '',
      contact_phone: ''
    })
  }

  useEffect(() => {
    loadEvents()
    loadProperties()
  }, [])

  async function loadProperties() {
    const { data } = await supabase.from('properties').select('id, address, unit_number').order('address')
    if (data) setProperties(data)
  }

  async function loadEvents() {
    try {
      const calEvents: CalendarEvent[] = []

      // Custom events from calendar_events table
      const { data: customEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .order('event_date', { ascending: true })
      
      if (customEvents) {
        setDbEvents(customEvents)
        for (const e of customEvents) {
          if (e.status === 'cancelled') continue
          calEvents.push({
            id: e.id,
            date: e.event_date,
            label: e.title,
            type: (e.event_type as any) || 'appointment',
            property: e.location || '—',
            details: e.description || (e.event_time ? `${e.event_time.substring(0, 5)} · ${e.duration_minutes}min` : `${e.duration_minutes}min`)
          })
        }
      }

      // Google Calendar events (from agent-created events)
      try {
        const gcalRes = await fetch('/api/calendar')
        if (gcalRes.ok) {
          const gcalEvents = await gcalRes.json()
          for (const e of gcalEvents) {
            const start = e.start?.dateTime || e.start?.date || ''
            const dateOnly = start.includes('T') ? start.split('T')[0] : start
            const timeStr = e.start?.dateTime
              ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
              : ''
            const isAllDay = !!e.start?.date && !e.start?.dateTime
            const isMultiDay = isAllDay && e.end?.date && e.end.date !== e.start?.date

            // Compute date range: for multi-day all-day events, expand to each day
            const datesToShow: string[] = [dateOnly]
            if (isMultiDay) {
              const s = new Date(e.start.date + 'T12:00:00')
              const en = new Date(e.end.date + 'T12:00:00')
              // end.date is exclusive in Google Calendar API
              const cursor = new Date(s)
              cursor.setDate(cursor.getDate() + 1)
              while (cursor < en) {
                datesToShow.push(cursor.toISOString().split('T')[0])
                cursor.setDate(cursor.getDate() + 1)
              }
            }

            // Compute duration from start/end for timed events
            let durationStr = ''
            if (e.start?.dateTime && e.end?.dateTime) {
              const durMs = new Date(e.end.dateTime).getTime() - new Date(e.start.dateTime).getTime()
              const durMin = Math.round(durMs / 60000)
              if (durMin >= 60) {
                const h = Math.floor(durMin / 60)
                const m = durMin % 60
                durationStr = m ? `${h}h ${m}m` : `${h}h`
              } else {
                durationStr = `${durMin}min`
              }
            }

            for (const d of datesToShow) {
              calEvents.push({
                id: e.id + (datesToShow.length > 1 ? '_' + d : ''),
                date: d,
                label: e.summary || 'Untitled',
                type: 'appointment',
                property: e.location || '—',
                details: isMultiDay
                  ? `All day (${datesToShow.length} days)`
                  : isAllDay
                    ? 'All day'
                    : (timeStr ? `${timeStr} · ${durationStr}` : durationStr || 'Google Calendar'),
                _custom: true,
              _gcalId: e.id,
              _gcalEvent: e
            })
          }
        }
      }
      } catch (gcalErr) {
        console.error('Failed to fetch Google Calendar events:', gcalErr)
      }

      // Custom events from calendar_events table (created via dashboard form)
      try {
        const { data: customEvents } = await supabase
          .from('calendar_events')
          .select('*')
          .order('event_date', { ascending: true })

        if (customEvents) {
          for (const e of customEvents) {
            if (e.status === 'cancelled') continue
            const timeStr = e.event_time ? `${e.event_time.substring(0, 5)}` : ''
            const durationStr = e.duration_minutes ? ` · ${e.duration_minutes}min` : ''
            calEvents.push({
              date: e.event_date,
              label: e.title,
              type: e.event_type || 'appointment',
              property: e.location || '—',
              details: e.description || (timeStr ? `${timeStr}${durationStr}` : durationStr.trim() || '')
            })
          }
        }
      } catch (err) {
        console.error('Failed to load custom events:', err)
      }

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
            details: `$${Number(e.monthly_rent).toLocaleString()}/mo`
          })
        }
      }

      // Rent due dates
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title.trim()) return

    const API = import.meta.env.DEV ? 'http://localhost:3000' : ''
    const duration_minutes = formData.duration_minutes || 60

    try {
      const body = {
        title: formData.title,
        date: formData.event_date,
        time: formData.event_time || undefined,
        description: [formData.description, formData.location ? `Location: ${formData.location}` : '', formData.contact_name ? `Contact: ${formData.contact_name} ${formData.contact_phone || ''}` : ''].filter(Boolean).join('\n'),
        duration_minutes
      }

      if (editingEvent?._gcalId) {
        // Update via Google Calendar API — use delete + create for simplicity
        await fetch(`${API}/api/calendar?id=${editingEvent._gcalId}`, { method: 'DELETE' })
      }

      const res = await fetch(`${API}/api/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok && res.status !== 201) {
        throw new Error(`HTTP ${res.status}`)
      }

      setShowForm(false)
      resetForm()
      await loadEvents()
    } catch (err) {
      console.error('Failed to create event:', err)
      alert('Failed to create event. Check console for details.')
    }
  }

  async function handleDelete(eventId: string) {
    if (!confirm('Cancel this event?')) return

    const headers: Record<string, string> = {
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }

    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/calendar_events?id=eq.${eventId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'cancelled' })
      })
      setSelectedEvent(null)
      await loadEvents()
    } catch (err) {
      console.error('Failed to cancel event:', err)
    }
  }

  const getEventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr)

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
    inspection: <AlertTriangle size={14} />,
    appointment: <Clock size={14} />,
    meeting: <User size={14} />,
    showing: <MapPin size={14} />,
    maintenance: <AlertTriangle size={14} />
  }

  if (loading) return <div className="loading-state"><CalendarIcon /> <p>Loading calendar...</p></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Calendar</h1>
          <p>Lease expirations, rent due dates, inspections, appointments, and tasks</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> New Event
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Calendar Grid */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
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
          <div className="card-body" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, minWidth: 350 }}>
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
                const hasCustomEvent = dayEvents.some(e => e.id)
                return (
                  <div
                    key={dateStr}
                    onClick={() => {
                      const custom = dbEvents.find(e => e.event_date === dateStr)
                      if (custom) setSelectedEvent(custom)
                      else {
                        setFormData(prev => ({ ...prev, event_date: dateStr }))
                        setShowForm(true)
                      }
                    }}
                    style={{
                      minHeight: 90,
                      background: isToday ? 'var(--accent-light)' : 'transparent',
                      border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                      marginBottom: 2
                    }}>
                      {d}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {dayEvents.slice(0, 4).map((ev, ei) => {
                        const colors = EVENT_COLORS[ev.type] || EVENT_COLORS.appointment
                        return (
                          <div
                            key={ei}
                            style={{
                              fontSize: 9,
                              padding: '1px 3px',
                              borderRadius: 2,
                              background: colors.bg,
                              color: colors.color,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: '14px'
                            }}
                            title={`${ev.label} — ${ev.property}`}
                          >
                            {ev.label.substring(0, 12)}
                          </div>
                        )
                      })}
                      {dayEvents.length > 4 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{dayEvents.length - 4} more</div>
                      )}
                    </div>
                    {hasCustomEvent && (
                      <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--yellow)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Legend */}
          <div className="card-body" style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary)' }}>
            {Object.entries(EVENT_COLORS).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: val.dot }} />
                <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Events Sidebar */}
        <div className="card" style={{ width: 300, flexShrink: 0, maxHeight: 700, overflow: 'auto' }}>
          <div className="card-header"><h3>All Events</h3></div>
          <div className="card-body">
            {events.length === 0 ? (
              <div className="empty-state"><CalendarIcon /> <p>No upcoming events</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {events.slice(0, 30).map((ev, i) => {
                  const [y, m, d] = ev.date.split('-').map(Number)
                  const eventDate = new Date(y, m - 1, d, 12, 0, 0)
                  const todayMid = new Date()
                  todayMid.setHours(12, 0, 0, 0)
                  const daysUntil = Math.ceil((eventDate.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24))
                  const colors = EVENT_COLORS[ev.type] || EVENT_COLORS.appointment
                  const customEv = ev.id ? dbEvents.find(e => e.id === ev.id) : null
                  return (
                    <div
                      key={`${ev.date}-${i}`}
                      onClick={() => customEv && setSelectedEvent(customEv)}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        cursor: customEv ? 'pointer' : 'default',
                        borderLeft: `3px solid ${colors.dot}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ color: colors.color }}>{eventIcons[ev.type] || <Clock size={14} />}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{ev.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                        {ev.property}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                        <span>{eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                        <span style={{
                          color: daysUntil <= 0 ? 'var(--red)' : daysUntil <= 7 ? 'var(--yellow)' : 'var(--text-muted)',
                          fontWeight: daysUntil <= 7 ? 600 : 400
                        }}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : daysUntil === 0 ? 'Today' : `${daysUntil} days`}
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

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{selectedEvent.title}</h3>
              <button className="filter-btn" onClick={() => setSelectedEvent(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: EVENT_COLORS[selectedEvent.event_type]?.bg || EVENT_COLORS.appointment.bg, color: EVENT_COLORS[selectedEvent.event_type]?.color || '#f59e0b' }}>
                    {selectedEvent.event_type.replace('_', ' ')}
                  </span>
                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--blue)' }}>
                    {selectedEvent.status}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}></span>
                    <span>{new Date(selectedEvent.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  {selectedEvent.event_time && <>
                    <span style={{ color: 'var(--text-muted)' }}></span>
                    <span>{selectedEvent.event_time.substring(0, 5)} · {selectedEvent.duration_minutes} min</span>
                  </>}
                  {selectedEvent.location && <>
                    <span style={{ color: 'var(--text-muted)' }}></span>
                    <span>{selectedEvent.location}</span>
                  </>}
                  {selectedEvent.contact_name && <>
                    <span style={{ color: 'var(--text-muted)' }}></span>
                    <span>{selectedEvent.contact_name}</span>
                  </>}
                  {selectedEvent.contact_phone && <>
                    <span style={{ color: 'var(--text-muted)' }}></span>
                    <span>{selectedEvent.contact_phone}</span>
                  </>}
                </div>
                {selectedEvent.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                    {selectedEvent.description}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={() => handleDelete(selectedEvent.id)} style={{ fontSize: 13, padding: '6px 16px' }}>
                Delete Event
              </button>
              <button className="btn" onClick={() => setSelectedEvent(null)} style={{ fontSize: 13, padding: '6px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Event Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>New Event</h3>
              <button className="filter-btn" onClick={() => { setShowForm(false); resetForm(); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Event Type</label>
                  <select
                    className="form-input"
                    value={formData.event_type}
                    onChange={e => setFormData(prev => ({ ...prev, event_type: e.target.value as EventFormType }))}
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="form-input"
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Handyman visit at 150 E 61st"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.event_date}
                      onChange={e => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input
                      className="form-input"
                      type="time"
                      value={formData.event_time}
                      onChange={e => setFormData(prev => ({ ...prev, event_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration (minutes)</label>
                  <select
                    className="form-input"
                    value={formData.duration_minutes}
                    onChange={e => setFormData(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Property (optional)</label>
                  <select
                    className="form-input"
                    value={formData.property_id}
                    onChange={e => setFormData(prev => ({ ...prev, property_id: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.address}{p.unit_number ? ` ${p.unit_number}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    className="form-input"
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., 150 East 61st St, Unit 8C"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Any notes about this event..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.contact_name}
                      onChange={e => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                      placeholder="Contractor name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.contact_phone}
                      onChange={e => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      placeholder="(212) 555-..."
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!formData.title.trim()}
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
