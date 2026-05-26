import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBadge } from './ui/StatusBadge'
import { Modal } from './ui/Modal'
import { TaskForm } from './TaskForm'
import { Plus, Clock, CheckCircle, ChevronDown, CheckSquare, Square, Users, ArrowUpDown } from 'lucide-react'

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

type SortMode = 'due_date_asc' | 'priority_desc' | 'created_desc'

const QUICK_FILTERS = [
  { label: '🔍 All My Tasks', person: 'all', type: 'all' },
  { label: '🔧 Maggie: Repairs', person: 'maggie', type: 'repairs' },
  { label: '🔍 Maggie: Inspections', person: 'maggie', type: 'inspection' },
  { label: '💰 Maggie: Rent Followup', person: 'maggie', type: 'rent_followup' },
  { label: '📄 James: Lease Renewals', person: 'James', type: 'lease_renewal' },
  { label: '🔧 James: Repairs', person: 'James', type: 'repairs' },
  { label: '📋 Jenna: All', person: 'Jenna', type: 'all' },
]

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [personFilter, setPersonFilter] = useState('maggie')
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('due_date_asc')
  const [updating, setUpdating] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [clearing, setClearing] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<any>(null)

  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const selectAllOnPageRef = useRef<HTMLInputElement>(null)

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
        supabase.from('tasks').select('id, title, task_type, priority, due_date, status, assigned_to, property_id, tenant_id, notes, created_at').neq('status', 'completed').neq('status', 'archived').order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('properties').select('id, address, unit_number'),
        supabase.from('tenants').select('id, first_name, last_name, property_id'),
      ])
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

  async function bulkComplete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Complete ${selectedIds.size} selected task(s)?`)) return
    setBulkUpdating(true)
    const ids = Array.from(selectedIds)
    try {
      for (const id of ids) {
        await supabase.from('tasks').update({
          status: 'completed',
          completed_at: new Date().toISOString()
        }).eq('id', id)
      }
      await supabase.from('activity_log').insert({
        action: 'Tasks bulk completed',
        details: `Completed ${ids.length} tasks via bulk action`,
        source: 'manual'
      })
      setSelectedIds(new Set())
      setTimeout(loadTasks, 300)
    } catch (err) {
      console.error('Failed to bulk complete:', err)
    } finally {
      setBulkUpdating(false)
    }
  }

  async function bulkAssign(assignee: string) {
    if (selectedIds.size === 0) return
    if (!confirm(`Assign ${selectedIds.size} task(s) to ${assignee}?`)) return
    setBulkUpdating(true)
    const ids = Array.from(selectedIds)
    try {
      for (const id of ids) {
        await supabase.from('tasks').update({ assigned_to: assignee }).eq('id', id)
      }
      setSelectedIds(new Set())
      setTimeout(loadTasks, 300)
    } catch (err) {
      console.error('Failed to bulk assign:', err)
    } finally {
      setBulkUpdating(false)
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
      loadTasks()
      loadCompletedTasks()
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }

  function applyQuickFilter(qf: typeof QUICK_FILTERS[number]) {
    setPersonFilter(qf.person)
    setTypeFilter(qf.type)
    setFilter('all')
    setSelectedIds(new Set())
  }

  // Sorting
  function sortTasks(list: Task[]) {
    const sorted = [...list]
    if (sortMode === 'due_date_asc') {
      sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    } else if (sortMode === 'priority_desc') {
      const rank = { urgent: 0, high: 1, medium: 2, low: 3 }
      sorted.sort((a, b) => (rank[a.priority as keyof typeof rank] ?? 99) - (rank[b.priority as keyof typeof rank] ?? 99))
    } else if (sortMode === 'created_desc') {
      sorted.sort((a, b) => ((b as any).created_at || '').localeCompare((a as any).created_at || ''))
    }
    return sorted
  }

  const filtered = sortTasks(tasks.filter(t => {
    if (personFilter !== 'all') {
      const assignee = ((t as any).assigned_to || '').toLowerCase()
      if (!assignee.includes(personFilter.toLowerCase())) return false
    }
    if (filter === 'overdue' && t.due_date && new Date(t.due_date) >= new Date()) return false
    if (filter === 'today' && t.due_date && new Date(t.due_date).toDateString() !== new Date().toDateString()) return false
    return true
  }).filter(t => {
    if (typeFilter === 'all') return true
    return t.task_type === typeFilter
  }))

  // Reset to page 1 when filters change
  const prevFilterKey = useRef('')
  const filterKey = `${personFilter}|${filter}|${typeFilter}|${sortMode}`
  if (filterKey !== prevFilterKey.current) {
    prevFilterKey.current = filterKey
    setTimeout(() => setPage(1), 0)
  }

  const visibleTasks = filtered.slice(0, page * PAGE_SIZE)

  // Bulk select helpers
  const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every(t => selectedIds.has(t.id))
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleTasks.map(t => t.id)))
    }
  }
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const CATEGORIES = [
    'repairs', 'inspection', 'lease_renewal',
    'payment_followup', 'lease_break', 'tenant_move_in',
    'tenant_move_out', 'rent_followup', 'emergency',
    'bookkeeping', 'general', 'owner_report',
    'cleaning', 'lease_signing'
  ]

  if (loading) return <div className="loading-state"><Clock /> <p>Loading tasks...</p></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Tasks</h1>
          <p>{tasks.length} open • {tasks.filter(t => t.priority === 'urgent').length} urgent • {tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length} overdue</p>
        </div>
        <button onClick={() => { setEditTask(null); setShowForm(true) }} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Quick-filter pills */}
      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        {QUICK_FILTERS.map(qf => (
          <button
            key={qf.label}
            className={`filter-btn ${personFilter === qf.person && typeFilter === qf.type && filter === 'all' ? 'active' : ''}`}
            onClick={() => applyQuickFilter(qf)}
            style={{ fontSize: 12 }}
          >
            {qf.label}
          </button>
        ))}
      </div>

      {/* Person + status filters */}
      <div className="filter-bar">
        <button className={`filter-btn ${personFilter === 'maggie' ? 'active' : ''}`} onClick={() => { setPersonFilter('maggie'); setSelectedIds(new Set()) }}>Maggie</button>
        <button className={`filter-btn ${personFilter === 'James' ? 'active' : ''}`} onClick={() => { setPersonFilter('James'); setSelectedIds(new Set()) }}>James</button>
        <button className={`filter-btn ${personFilter === 'Jenna' ? 'active' : ''}`} onClick={() => { setPersonFilter('Jenna'); setSelectedIds(new Set()) }}>Jenna</button>
        <button className={`filter-btn ${personFilter === 'all' ? 'active' : ''}`} onClick={() => { setPersonFilter('all'); setSelectedIds(new Set()) }}>All</button>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => { setFilter('all'); setSelectedIds(new Set()) }}>All</button>
        <button className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`} onClick={() => { setFilter('overdue'); setSelectedIds(new Set()) }}>Overdue</button>
        <button className={`filter-btn ${filter === 'today' ? 'active' : ''}`} onClick={() => { setFilter('today'); setSelectedIds(new Set()) }}>Due Today</button>
      </div>

      {/* Type filter + sort toggle */}
      <div className="filter-bar">
        <button className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => { setTypeFilter('all'); setSelectedIds(new Set()) }}>All Types</button>
        {CATEGORIES.map(type => (
          <button key={type}
            className={`filter-btn ${typeFilter === type ? 'active' : ''}`}
            onClick={() => { setTypeFilter(type); setSelectedIds(new Set()) }}>
            {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer'
            }}
          >
            <option value="due_date_asc">Due Date ↑</option>
            <option value="priority_desc">Priority</option>
            <option value="created_desc">Newest</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
          background: 'var(--accent-light)', borderRadius: 8, marginBottom: 12,
          border: '1px solid var(--accent)', fontSize: 13
        }}>
          <CheckSquare size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600 }}>{selectedIds.size} selected</span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button
              onClick={bulkComplete}
              disabled={bulkUpdating}
              className="filter-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)', fontWeight: 600, fontSize: 12 }}
            >
              <CheckCircle size={14} /> Complete
            </button>
            <span style={{ color: 'var(--border)', alignSelf: 'center' }}>|</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Assign to:</span>
            {['Maggie', 'James', 'Jenna'].map(name => (
              <button
                key={name}
                onClick={() => bulkAssign(name)}
                disabled={bulkUpdating}
                className="filter-btn"
                style={{ fontSize: 12 }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div className="empty-state"><CheckCircle /> <p>No tasks match current filters</p></div>
        )}
        {/* Select all header */}
        {visibleTasks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
              <input
                ref={selectAllOnPageRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer' }}
              />
              Select all {visibleTasks.length} on page
            </label>
          </div>
        )}
        {visibleTasks.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date()
          const isSelected = selectedIds.has(t.id)
          return (
            <div
              key={t.id}
              className="property-card"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                border: isSelected ? '1.5px solid var(--accent)' : undefined,
                background: isSelected ? 'var(--accent-light)' : undefined,
                transition: 'all 0.1s ease'
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(t.id)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
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

      {/* Pagination - Show More */}
      {filtered.length > page * PAGE_SIZE && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => setPage(p => p + 1)}
            className="filter-btn"
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Show {Math.min(PAGE_SIZE, filtered.length - page * PAGE_SIZE)} more · {filtered.length - page * PAGE_SIZE} remaining
          </button>
        </div>
      )}
      {filtered.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length} tasks
        </div>
      )}

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
