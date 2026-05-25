import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBadge } from './ui/StatusBadge'
import { Modal } from './ui/Modal'
import { TaskForm } from './TaskForm'
import { Plus, Clock, CheckCircle } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  task_type: string
  priority: string
  due_date: string | null
  status: string
  address: string | null
  unit_number: string | null
  tenant_name: string | null
  completed_at?: string | null
}

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [personFilter, setPersonFilter] = useState('maggie')
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [clearing, setClearing] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<any>(null)

  useEffect(() => {
    loadTasks()
    const channel = supabase.channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadTasks() {
    try {
      const [tasksRes, propsRes, tenantsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, task_type, priority, due_date, status, assigned_to, property_id, tenant_id, notes').neq('status', 'completed').neq('status', 'archived').order('priority', { ascending: true }),
        supabase.from('properties').select('id, address, unit_number'),
        supabase.from('tenants').select('id, first_name, last_name, property_id'),
      ])
      // Hydrate address from properties
      const propsMap = Object.fromEntries((propsRes.data || []).map((p: any) => [p.id, p]))
      const tenantsMap = Object.fromEntries((tenantsRes.data || []).map((t: any) => [t.id, t]))
      const hydrated = (tasksRes.data || []).map((t: any) => {
        const prop = propsMap[t.property_id] || {}
        const ten = tenantsMap[t.tenant_id] || {}
        return { ...t, address: prop.address || null, unit_number: prop.unit_number || null, tenant_name: ten.first_name && ten.last_name ? `${ten.first_name} ${ten.last_name}` : null }
      })
      setTasks(hydrated)
      setProperties(propsRes.data || [])
      setTenants(tenantsRes.data || [])
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadCompletedTasks() {
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50)
      setCompletedTasks(data || [])
    } catch (err) {
      console.error('Failed to load completed tasks:', err)
    }
  }

  async function clearCompleted() {
    if (!confirm('Archive all completed tasks? They will be hidden from view.')) return
    setClearing(true)
    try {
      const ids = completedTasks.map(t => t.id)
      for (const id of ids) {
        await supabase.from('tasks').update({ status: 'archived' }).eq('id', id)
      }
      await supabase.from('activity_log').insert({
        action: 'Completed tasks cleared',
        details: `Archived ${ids.length} completed tasks`,
        source: 'manual'
      })
      setCompletedTasks([])
      setShowCompleted(false)
    } catch (err) {
      console.error('Failed to clear completed tasks:', err)
    } finally {
      setClearing(false)
    }
  }

  async function markComplete(taskId: string) {
    setUpdating(taskId)
    try {
      await supabase.from('tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', taskId)
      await supabase.from('activity_log').insert({
        action: 'Task completed',
        details: `Task completed: ${tasks.find(t => t.id === taskId)?.title}`,
        source: 'manual'
      })
      setTimeout(loadTasks, 300)
    } catch (err) {
      console.error('Failed to complete task:', err)
    } finally {
      setUpdating(null)
    }
  }

  async function undoComplete(taskId: string, title: string) {
    try {
      await supabase.from('tasks').update({
        status: 'pending',
        completed_at: null
      }).eq('id', taskId)
      await supabase.from('activity_log').insert({
        action: 'Task restored',
        details: `Restored from completed: ${title}`,
        source: 'manual'
      })
      // Refresh both lists
      loadTasks()
      loadCompletedTasks()
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }

  const filtered = tasks.filter(t => {
    if (personFilter !== 'all' && (t as any).assigned_to !== personFilter) return false
    if (filter === 'overdue' && t.due_date && new Date(t.due_date) >= new Date()) return false
    if (filter === 'today' && t.due_date && new Date(t.due_date).toDateString() !== new Date().toDateString()) return false
    return true
  }).filter(t => {
    if (typeFilter === 'all') return true
    return t.task_type === typeFilter
  })

  const CATEGORIES = [
    'repairs', 'inspection', 'lease_renewal',
    'payment_followup', 'lease_break', 'tenant_move_in',
    'tenant_move_out', 'rent_followup', 'emergency',
    'bookkeeping', 'general', 'owner_report'
  ]

  if (loading) return <div className="loading-state"><Clock /> <p>Loading tasks...</p></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Tasks</h1>
          <p>{tasks.length} open • {tasks.filter(t => t.priority === 'urgent').length} urgent</p>
        </div>
        <button onClick={() => { setEditTask(null); setShowForm(true) }} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${personFilter === 'maggie' ? 'active' : ''}`} onClick={() => setPersonFilter('maggie')}>Maggie</button>
        <button className={`filter-btn ${personFilter === 'James' ? 'active' : ''}`} onClick={() => setPersonFilter('James')}>James</button>
        <button className={`filter-btn ${personFilter === 'Jenna' ? 'active' : ''}`} onClick={() => setPersonFilter('Jenna')}>Jenna</button>
        <button className={`filter-btn ${personFilter === 'all' ? 'active' : ''}`} onClick={() => setPersonFilter('all')}>All</button>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>Overdue</button>
        <button className={`filter-btn ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>Due Today</button>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>All Types</button>
        {CATEGORIES.map(type => (
          <button key={type}
            className={`filter-btn ${typeFilter === type ? 'active' : ''}`}
            onClick={() => setTypeFilter(type)}>
            {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div className="empty-state"><CheckCircle /> <p>No tasks match current filters</p></div>
        )}
        {filtered.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date()
          return (
            <div key={t.id} className="property-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => markComplete(t.id)}
                disabled={updating === t.id}
                style={{
                  background: 'none', border: '2px solid var(--border)',
                  borderRadius: 6, width: 24, height: 24, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'var(--text-muted)'
                }}
                title="Mark complete"
              >
                {updating === t.id ? '...' : ''}
              </button>
              <div style={{ flex: 1, cursor: 'pointer' }}
                onClick={async () => {
                  const { data } = await supabase.from('tasks').select('*').eq('id', t.id).single()
                  setEditTask(data || t)
                  setShowForm(true)
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`priority-dot priority-${t.priority}`} />
                  <span style={{ fontWeight: 600 }}>{t.title}</span>
                  <StatusBadge status={t.task_type} variant="gray" />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {t.address && <span>{t.address}</span>}
                  {(t as any).assigned_to && <span style={{ fontWeight: 500 }}>👤 {(t as any).assigned_to}</span>}
                  {t.tenant_name && <span>Tenant: {t.tenant_name}</span>}
                  {t.due_date && (
                    <span style={{ color: isOverdue ? 'var(--red)' : 'inherit', fontWeight: isOverdue ? 600 : 400 }}>
                      Due: {new Date(t.due_date).toLocaleDateString()}
                      {isOverdue ? ' (overdue)' : ''}
                    </span>
                  )}
                </div>
              </div>
              <span className={`badge ${t.priority === 'urgent' ? 'badge-red' : t.priority === 'high' ? 'badge-yellow' : t.priority === 'medium' ? 'badge-blue' : 'badge-gray'}`}>
                {t.priority}
              </span>
            </div>
          )
        })}
      </div>

      {/* Completed tasks toggle */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => { setShowCompleted(!showCompleted); if (!showCompleted) loadCompletedTasks() }}
          className="filter-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <CheckCircle size={14} />
          {showCompleted ? 'Hide' : 'Show'} recently completed
        </button>
      </div>

      {showCompleted && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>Completed Tasks</h3>
            {completedTasks.length > 0 && (
              <button
                onClick={clearCompleted}
                disabled={clearing}
                className="filter-btn"
                style={{ fontSize: 12, color: 'var(--red)' }}
              >
                {clearing ? 'Archiving...' : 'Clear all'}
              </button>
            )}
          </div>
          <div className="card-body">
            {completedTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '16px 0' }}>
                <CheckCircle size={20} /> <p>No completed tasks</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, opacity: 0.7 }}>
                {completedTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ color: 'var(--green)' }}>✓</span>
                    <span style={{ textDecoration: 'line-through' }}>{t.title}</span>
                    {t.completed_at && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                        {new Date(t.completed_at).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); undoComplete(t.id, t.title) }}
                      style={{
                        marginLeft: 'auto',
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                        color: 'var(--accent)', fontSize: 11, fontWeight: 600
                      }}
                      title="Restore to pending"
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditTask(null) }}
        title={editTask ? 'Edit Task' : 'New Task'} width="560px">
        <TaskForm properties={properties} tenants={tenants} task={editTask}
          onSaved={() => { setShowForm(false); setEditTask(null); loadTasks() }}
          onCancel={() => { setShowForm(false); setEditTask(null) }} />
      </Modal>
    </div>
  )
}
