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
}

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)

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
        supabase.from('open_tasks_by_priority').select('*'),
        supabase.from('properties').select('id, address, unit_number'),
        supabase.from('tenants').select('id, first_name, last_name, property_id'),
      ])
      setTasks(tasksRes.data || [])
      setProperties(propsRes.data || [])
      setTenants(tenantsRes.data || [])
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
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

  const filtered = tasks.filter(t => {
    if (filter === 'overdue' && t.due_date && new Date(t.due_date) >= new Date()) return false
    if (filter === 'today' && t.due_date && new Date(t.due_date).toDateString() !== new Date().toDateString()) return false
    return true
  }).filter(t => {
    if (typeFilter === 'all') return true
    return t.task_type === typeFilter
  })

  const taskTypes = [...new Set(tasks.map(t => t.task_type).filter(Boolean))]

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
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>Overdue</button>
        <button className={`filter-btn ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>Due Today</button>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>All Types</button>
        {taskTypes.map(type => (
          <button key={type}
            className={`filter-btn ${typeFilter === type ? 'active' : ''}`}
            onClick={() => setTypeFilter(type)}>
            {type.replace(/_/g, ' ')}
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
                onClick={() => { setEditTask(t); setShowForm(true) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`priority-dot priority-${t.priority}`} />
                  <span style={{ fontWeight: 600 }}>{t.title}</span>
                  <StatusBadge status={t.task_type} variant="gray" />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                  {t.address && <span>{t.address}</span>}
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

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditTask(null) }}
        title={editTask ? 'Edit Task' : 'New Task'} width="560px">
        <TaskForm properties={properties} tenants={tenants} task={editTask}
          onSaved={() => { setShowForm(false); setEditTask(null); loadTasks() }}
          onCancel={() => { setShowForm(false); setEditTask(null) }} />
      </Modal>
    </div>
  )
}
