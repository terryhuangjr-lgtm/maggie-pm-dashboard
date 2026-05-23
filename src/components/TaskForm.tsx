import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface TaskFormProps {
  properties: { id: string, address: string, unit_number: string | null }[]
  tenants: { id: string, first_name: string, last_name: string, property_id: string }[]
  task?: any
  onSaved: () => void
  onCancel: () => void
}

const taskTypes = [
  'lease_renewal', 'rent_collection', 'maintenance_request',
  'inspection', 'board_application', 'move_in', 'move_out',
  'owner_report', 'general', 'follow_up'
]

export function TaskForm({ properties, tenants, task, onSaved, onCancel }: TaskFormProps) {
  const isEdit = !!task
  const [form, setForm] = useState({
    property_id: task?.property_id || '',
    tenant_id: task?.tenant_id || '',
    title: task?.title || '',
    description: task?.description || '',
    task_type: task?.task_type || 'general',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
    status: task?.status || 'pending',
    assigned_to: task?.assigned_to || '',
    notes: task?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: string) => setForm({ ...form, [field]: value })

  const filteredTenants = form.property_id
    ? tenants.filter(t => t.property_id === form.property_id)
    : tenants

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const data: any = {
        title: form.title,
        task_type: form.task_type,
        priority: form.priority,
        status: form.status,
      }
      if (form.property_id) data.property_id = form.property_id
      if (form.tenant_id) data.tenant_id = form.tenant_id
      if (form.description) data.description = form.description
      if (form.due_date) data.due_date = form.due_date
      if (form.assigned_to) data.assigned_to = form.assigned_to
      if (form.notes) data.notes = form.notes

      if (isEdit) {
        await supabase.from('tasks').update(data).eq('id', task.id)
      } else {
        const { error: insertErr } = await supabase.from('tasks').insert(data)
        if (insertErr) throw insertErr
      }

      await supabase.from('activity_log').insert({
        action: isEdit ? 'Task updated' : 'Task created',
        details: `${isEdit ? 'Updated' : 'Created'} task: ${form.title}`,
        source: 'manual'
      })

      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div>
        <label style={labelStyle}>Title *</label>
        <input style={fieldStyle} value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. Schedule inspection at 200 West St" />
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Description</label>
        <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Details about this task..." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Task Type</label>
          <select style={fieldStyle} value={form.task_type} onChange={e => set('task_type', e.target.value)}>
            {taskTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Priority</label>
          <select style={fieldStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Due Date</label>
          <input style={fieldStyle} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Property</label>
          <select style={fieldStyle} value={form.property_id} onChange={e => {
            set('property_id', e.target.value)
            set('tenant_id', '')
          }}>
            <option value="">— No property —</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.address}{p.unit_number ? ` ${p.unit_number}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Tenant</label>
          <select style={fieldStyle} value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)}>
            <option value="">— No tenant —</option>
            {filteredTenants.map(t => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Assigned To</label>
        <select style={fieldStyle} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
          <option value="">— Unassigned —</option>
          <option value="Maggie">Maggie</option>
          <option value="James">James</option>
          <option value="Jenna">Jenna</option>
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <button type="button" className="filter-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: saving ? 'var(--text-muted)' : 'var(--accent)',
          color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer'
        }}>
          {saving ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  )
}
