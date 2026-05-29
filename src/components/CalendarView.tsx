import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar as CalendarIcon, Clock, DollarSign, AlertTriangle, Plus, X, MapPin, User, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

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

type EditableEventType = 'appointment' | 'meeting' | 'showing' | 'maintenance' | 'inspection'

const EVENT_TYPE_LABELS: Record<EditableEventType, string> = {
  appointment: 'Appointment',
  meeting: 'Meeting',
  showing: 'Property Showing',
  maintenance: 'Maintenance',
  inspection: 'Inspection'
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarView() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'appointment' as EditableEventType,
    event_date: new Date().toISOString().split('T')[0],
    event_time: '09:00',
    duration_minutes: 60,
    property_id: '',
    location: '',
    contact_name: '',
    contact_phone: ''
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const todayStr = new Date().toISOString().split('T')[0]

  const getLocalDateStr = (d: Date) => {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60000)
    return local.toISOString().split('T')[0]
  }

  useEffect(() => {
    loadEvents()
  }, [])

  useEffect(() => {
    if (!selectedDate && events.length > 0) {
      // Default to today
      const today = getLocalDateStr(new Date())
      setSelectedDate(today)
    }
  }, [events])

  async function loadEvents() {
    try {
      const calEvents: any[] = []

      // Google Calendar events (SOURCE OF TRUTH for user-created events)
      try {
        const API = import.meta.env.DEV ? 'http://localhost:3000' : ''
        const res = await fetch(`${API}/api/calendar`)
        if (res.ok) {
          const gcalEvents = await res.json()
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
      } catch (err) {
        console.error('Failed to load Google Calendar events:', err)
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

      setEvents(calEvents.sort((a: any, b: any) => a.date.localeCompare(b.date)))
    } catch (err) {
      console.error('Failed to load calendar events:', err)
    } finally {
      setLoading(false)
    }
  }

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
    setEditingEvent(null)
  }

  function openEditEvent(ev: any) {
    setEditingEvent(ev)
    const start = ev.start?.dateTime || ev.start?.date || ''
    const dateOnly = start.includes('T') ? start.split('T')[0] : start
    const timeOnly = start.includes('T') ? start.split('T')[1]?.substring(0, 5) : ''

    // Compute actual duration from start/end
    let duration = 60
    if (ev.start?.dateTime && ev.end?.dateTime) {
      duration = Math.round((new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()) / 60000)
    }

    setFormData({
      title: ev.summary || ev.title || '',
      description: ev.description || '',
      event_type: 'appointment',
      event_date: dateOnly || '',
      event_time: timeOnly || '09:00',
      duration_minutes: duration,
      property_id: '',
      location: ev.location || '',
      contact_name: '',
      contact_phone: ''
    })
    setShowForm(true)
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

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      setShowForm(false)
      resetForm()
      await loadEvents()
    } catch (err) {
      console.error('Failed to save event:', err)
      alert('Failed to save event. Check console for details.')
    }
  }

  async function handleDelete(gcalId: string) {
    if (!confirm('Delete this event from Google Calendar?')) return

    const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

    try {
      const res = await fetch(`${API}/api/calendar?id=${gcalId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setShowForm(false)
      resetForm()
      await loadEvents()
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  const getEventsForDate = (dateStr: string) => events.filter((e: any) => e.date === dateStr)

  const firstDay = firstDayOfWeek
  const prevMonthDays = new Date(year, month, 0).getDate()

  const days: ({ day: number; other: boolean })[] = []
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: prevMonthDays - firstDay + i + 1, other: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, other: false })
  }
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, other: true })
    }
  }

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : []

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
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> New Event
        </button>
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {/* Calendar Grid */}
        <div className="card" style={{ flex: 1, minWidth: 400 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="filter-btn" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)) }}>
                <ChevronLeft size={16} />
              </button>
              <h3>{new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
              <button className="filter-btn" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)) }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="card-body" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, minWidth: 420 }}>
              {dayNames.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', padding: '10px 0' }}>
                  {d}
                </div>
              ))}
              {days.map((d, i) => {
                const actualDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
                // But events are always on actual dates, so use actualDateStr for lookup
                const lookupStr = actualDateStr
                const dayEvts = getEventsForDate(lookupStr)
                const isToday = lookupStr === todayStr
                const isSelected = lookupStr === selectedDate
                return (
                  <div
                    key={i}
                    className={`calendar-day ${d.other ? 'other-month' : ''}`}
                    onClick={() => setSelectedDate(lookupStr)}
                    style={{
                      minHeight: 110,
                      background: isSelected
                        ? 'var(--accent-light)'
                        : isToday
                          ? 'rgba(247, 147, 26, 0.08)'
                          : 'transparent',
                      border: isToday && isSelected
                        ? '1.5px solid var(--accent)'
                        : isToday
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      opacity: d.other ? 0.4 : 1
                    }}
                  >
                    <div style={{
                      fontSize: 14,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                      marginBottom: 4
                    }}>
                      {d.day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayEvts.slice(0, 5).map((ev: any, ei: number) => {
                        const colors = EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS] || EVENT_COLORS.appointment
                        return (
                          <div
                            key={ei}
                            style={{
                              fontSize: 10,
                              padding: '2px 4px',
                              borderRadius: 3,
                              background: colors.bg,
                              color: colors.color,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: '16px'
                            }}
                            title={`${ev.label} — ${ev.property}`}
                          >
                            {ev.label.substring(0, 16)}
                          </div>
                        )
                      })}
                      {dayEvts.length > 4 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{dayEvts.length - 4} more</div>
                      )}
                    </div>
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

        {/* Selected Day Events List */}
        <div className="card" style={{ width: 440, flexShrink: 0, maxHeight: 800, overflow: 'auto' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>
              {selectedDate
                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Select a day'}
            </h3>
            {selectedDate && (
              <button className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => {
                resetForm()
                setFormData(prev => ({ ...prev, event_date: selectedDate! }))
                setShowForm(true)
              }}>
                <Plus size={14} /> Add
              </button>
            )}
          </div>
          <div className="card-body">
            {!selectedDate ? (
              <div className="empty-state"><CalendarIcon /> <p>Click a day to see events</p></div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="empty-state"><CalendarIcon /> <p>No events for this day</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedDayEvents.map((ev: any, i: number) => {
                  const colors = EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS] || EVENT_COLORS.appointment
                  const isEditable = ev._custom && ev._gcalId
                  return (
                    <div
                      key={`${ev.date}-${i}`}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${colors.dot}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, cursor: isEditable ? 'pointer' : 'default' }}
                          onClick={() => isEditable && openEditEvent(ev._gcalEvent)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: colors.color }}>{eventIcons[ev.type] || <Clock size={14} />}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{ev.label}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 3 }}>
                            {ev.property}
                          </div>
                          {ev.details && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {ev.details}
                            </div>
                          )}
                        </div>
                        {isEditable && (
                          <button
                            onClick={() => handleDelete(ev._gcalId)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--text-muted)',
                              cursor: 'pointer', padding: 2, flexShrink: 0
                            }}
                            title="Cancel event"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editingEvent ? 'Edit Event' : 'New Event'}</h3>
              <button className="filter-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Title *</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Event title"
                    autoFocus
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Date</label>
                    <input type="date" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      value={formData.event_date}
                      onChange={e => setFormData({ ...formData, event_date: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Time</label>
                    <input type="time" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      value={formData.event_time}
                      onChange={e => setFormData({ ...formData, event_time: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Duration</label>
                    <select style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      value={formData.duration_minutes}
                      onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}>
                      <option value="0">All Day</option>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                      <option value="180">3 hours</option>
                      <option value="240">4 hours</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Type</label>
                    <select style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      value={formData.event_type}
                      onChange={e => setFormData({ ...formData, event_type: e.target.value as EditableEventType })}>
                      {(Object.entries(EVENT_TYPE_LABELS) as [EditableEventType, string][]).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Location</label>
                  <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Location" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Contact Name</label>
                    <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      value={formData.contact_name}
                      onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="Contact name" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Contact Phone</label>
                    <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      value={formData.contact_phone}
                      onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="Phone" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Description</label>
                  <textarea style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', minHeight: 60, resize: 'vertical' }}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Details..." />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="filter-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                }}>
                  {editingEvent ? 'Update Event' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
