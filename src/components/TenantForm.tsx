import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface TenantFormProps {
  propertyId: string
  tenant?: any
  onSaved: () => void
  onCancel: () => void
}

export function TenantForm({ propertyId, tenant, onSaved, onCancel }: TenantFormProps) {
  const isEdit = !!tenant
  const [form, setForm] = useState({
    first_name: tenant?.first_name || '',
    last_name: tenant?.last_name || '',
    email: tenant?.email || '',
    phone: tenant?.phone || '',
    language_preference: tenant?.language_preference || 'English',
    emergency_contact_name: tenant?.emergency_contact_name || '',
    emergency_contact_phone: tenant?.emergency_contact_phone || '',
    move_in_date: tenant?.move_in_date || '',
    status: tenant?.status || 'active',
    notes: tenant?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: string) => setForm({ ...form, [field]: value })

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
        property_id: propertyId,
        first_name: form.first_name,
        last_name: form.last_name,
        language_preference: form.language_preference,
        status: form.status,
      }
      if (form.email) data.email = form.email
      if (form.phone) data.phone = form.phone
      if (form.emergency_contact_name) data.emergency_contact_name = form.emergency_contact_name
      if (form.emergency_contact_phone) data.emergency_contact_phone = form.emergency_contact_phone
      if (form.move_in_date) data.move_in_date = form.move_in_date
      if (form.notes) data.notes = form.notes

      if (isEdit) {
        await supabase.from('tenants').update(data).eq('id', tenant.id)
      } else {
        const { error: insertErr } = await supabase.from('tenants').insert(data)
        if (insertErr) throw insertErr
      }

      await supabase.from('activity_log').insert({
        action: isEdit ? 'Tenant updated' : 'Tenant added',
        details: `${isEdit ? 'Updated' : 'Added'} tenant: ${form.first_name} ${form.last_name}${isEdit ? '' : ` for property`}`,
        source: 'manual'
      })

      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save tenant')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>First Name *</label>
          <input style={fieldStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Last Name *</label>
          <input style={fieldStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={fieldStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={fieldStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Language</label>
          <select style={fieldStyle} value={form.language_preference} onChange={e => set('language_preference', e.target.value)}>
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
            <option value="Korean">Korean</option>
            <option value="Japanese">Japanese</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="former">Former</option>
            <option value="pending_approval">Pending Approval</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Move In Date</label>
          <input style={fieldStyle} type="date" value={form.move_in_date} onChange={e => set('move_in_date', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Emergency Contact</label>
          <input style={fieldStyle} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Name" />
        </div>
        <div>
          <label style={labelStyle}>Emergency Phone</label>
          <input style={fieldStyle} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="Phone" />
        </div>
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
          {saving ? 'Saving...' : isEdit ? 'Update Tenant' : 'Add Tenant'}
        </button>
      </div>
    </form>
  )
}
