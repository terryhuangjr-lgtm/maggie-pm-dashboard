import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface LeaseFormProps {
  propertyId: string
  tenants: { id: string, first_name: string, last_name: string }[]
  lease?: any
  onSaved: () => void
  onCancel: () => void
}

export function LeaseForm({ propertyId, tenants, lease, onSaved, onCancel }: LeaseFormProps) {
  const isEdit = !!lease
  const today = new Date().toISOString().split('T')[0]
  const nextYear = new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
  
  const [form, setForm] = useState({
    tenant_id: lease?.tenant_id || '',
    lease_start: lease?.lease_start || today,
    lease_end: lease?.lease_end || nextYear,
    monthly_rent: lease?.monthly_rent || '',
    security_deposit: lease?.security_deposit || '',
    rent_due_day: lease?.rent_due_day || '1',
    auto_renew: lease?.auto_renew || false,
    status: lease?.status || 'active',
    notes: lease?.notes || '',
    deposit_returned_date: lease?.deposit_returned_date || '',
    deposit_returned_amount: lease?.deposit_returned_amount || '',
    deposit_deductions: lease?.deposit_deductions || '',
    deposit_deduction_notes: lease?.deposit_deduction_notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: any) => setForm({ ...form, [field]: value })

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
        tenant_id: form.tenant_id,
        lease_start: form.lease_start,
        lease_end: form.lease_end,
        monthly_rent: parseFloat(form.monthly_rent),
        rent_due_day: parseInt(form.rent_due_day),
        auto_renew: form.auto_renew,
        status: form.status,
      }
      if (form.security_deposit) data.security_deposit = parseFloat(form.security_deposit)
      if (form.notes) data.notes = form.notes

      if (isEdit) {
        await supabase.from('leases').update(data).eq('id', lease.id)
      } else {
        const { error: insertErr } = await supabase.from('leases').insert(data)
        if (insertErr) throw insertErr
      }

      await supabase.from('activity_log').insert({
        action: isEdit ? 'Lease updated' : 'Lease created',
        details: `Created lease for ${tenants.find(t => t.id === form.tenant_id)?.first_name || 'tenant'} — $${parseFloat(form.monthly_rent).toLocaleString()}/mo`,
        source: 'manual'
      })

      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save lease')
    } finally {
      setSaving(false)
    }
  }

  // Determine if deposit return fields should show
  const showDepositReturn = form.status === 'expired' || form.status === 'terminated'

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div>
        <label style={labelStyle}>Tenant *</label>
        <select style={fieldStyle} value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)} required>
          <option value="">— Select tenant —</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Lease Start *</label>
          <input style={fieldStyle} type="date" value={form.lease_start} onChange={e => set('lease_start', e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Lease End *</label>
          <input style={fieldStyle} type="date" value={form.lease_end} onChange={e => set('lease_end', e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Monthly Rent * ($)</label>
          <input style={fieldStyle} type="number" value={form.monthly_rent} onChange={e => set('monthly_rent', e.target.value)} required placeholder="4200" />
        </div>
        <div>
          <label style={labelStyle}>Security Deposit ($)</label>
          <input style={fieldStyle} type="number" value={form.security_deposit} onChange={e => set('security_deposit', e.target.value)} placeholder="4200" />
        </div>
        <div>
          <label style={labelStyle}>Rent Due Day</label>
          <input style={fieldStyle} type="number" min="1" max="31" value={form.rent_due_day} onChange={e => set('rent_due_day', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="pending_renewal">Pending Renewal</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" id="auto_renew" checked={form.auto_renew} onChange={e => set('auto_renew', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        <label htmlFor="auto_renew" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Auto-renewal</label>
      </div>

      {showDepositReturn && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Security Deposit Return</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Deposit Returned Date</label>
              <input style={fieldStyle} type="date" value={form.deposit_returned_date}
                onChange={e => set('deposit_returned_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Amount Returned ($)</label>
              <input style={fieldStyle} type="number" value={form.deposit_returned_amount}
                onChange={e => set('deposit_returned_amount', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Deductions ($)</label>
              <input style={fieldStyle} type="number" value={form.deposit_deductions}
                onChange={e => set('deposit_deductions', e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Deduction Notes</label>
            <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={form.deposit_deduction_notes}
              onChange={e => set('deposit_deduction_notes', e.target.value)} placeholder="Describe any deductions..." />
          </div>
        </>
      )}

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
          {saving ? 'Saving...' : isEdit ? 'Update Lease' : 'Create Lease'}
        </button>
      </div>
    </form>
  )
}
