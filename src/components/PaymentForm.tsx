import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface PaymentFormProps {
  propertyId: string
  leaseId: string
  tenantId?: string | null
  rentAmount: number
  payment?: any | null         // if provided, edit mode
  onSaved: () => void
  onCancel: () => void
}

export function PaymentForm({ propertyId, leaseId, tenantId, rentAmount, payment, onSaved, onCancel }: PaymentFormProps) {
  const isEdit = !!payment
  const [form, setForm] = useState({
    amount: payment ? String(payment.amount) : rentAmount.toString(),
    payment_type: payment?.payment_type || 'rent',
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    payment_method: payment?.payment_method || 'Zelle',
    status: payment?.status || 'received',
    adjustment_reason: payment?.adjustment_reason || '',
    notes: payment?.notes || ''
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function handleSave() {
    if (!form.amount) return alert('Amount is required')
    setLoading(true)

    try {
      const payload = {
        property_id: propertyId,
        lease_id: leaseId,
        tenant_id: tenantId || null,
        amount: parseFloat(form.amount),
        payment_type: form.payment_type,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        status: form.status,
        adjustment_reason: form.adjustment_reason || null,
        notes: form.notes || null
      }

      if (isEdit) {
        // Update existing payment
        const { error } = await supabase.from('payments').update(payload).eq('id', payment.id)
        if (error) throw error
      } else {
        // Calculate due date (first of the current month)
        const now = new Date()
        const dueDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const { error } = await supabase.from('payments').insert([{ ...payload, due_date: dueDate }])
        if (error) throw error
      }

      // Activity log
      const action = isEdit ? 'Payment updated' : 'Payment received'
      const details = isEdit
        ? `$${parseFloat(form.amount).toLocaleString()} (edited) — ${form.payment_method}`
        : `$${parseFloat(form.amount).toLocaleString()} logged via ${form.payment_method}`

      await supabase.from('activity_log').insert({
        property_id: propertyId,
        tenant_id: tenantId || null,
        action,
        details: form.adjustment_reason ? `${details} — ${form.adjustment_reason}` : details,
        source: 'manual'
      })

      onSaved()
    } catch (err) {
      console.error('Failed to save payment:', err)
      alert('Failed to save payment')
    } finally {
      setLoading(false)
    }
  }

  const fieldStyle = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: 4 }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Amount Received *</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 9, color: 'var(--text-muted)' }}>$</span>
            <input style={{ ...fieldStyle, paddingLeft: 24 }} type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Payment Type</label>
          <select style={fieldStyle} value={form.payment_type} onChange={e => set('payment_type', e.target.value)}>
            <option value="rent">Rent</option>
            <option value="security_deposit">Security Deposit</option>
            <option value="late_fee">Late Fee</option>
            <option value="maintenance">Maintenance</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Payment Date *</label>
          <input style={fieldStyle} type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Payment Method</label>
          <select style={fieldStyle} value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            <option value="Zelle">Zelle</option>
            <option value="Bank Transfer">Bank Transfer (ACH)</option>
            <option value="Wire Transfer">Wire Transfer</option>
            <option value="Check">Check</option>
            <option value="Cash">Cash</option>
            <option value="Venmo">Venmo</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Status</label>
        <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="received">Received / Cleared</option>
          <option value="pending">Pending / Processing</option>
          <option value="partial">Partial Payment</option>
        </select>
      </div>

      {(form.status === 'partial' || form.adjustment_reason) && (
        <div>
          <label style={labelStyle}>Adjustment Reason</label>
          <input
            style={fieldStyle}
            type="text"
            value={form.adjustment_reason}
            onChange={e => set('adjustment_reason', e.target.value)}
            placeholder="e.g. Credit for repair, Expense deduction, Agreed discount"
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Why was this amount different from the full rent?
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea style={fieldStyle} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Transaction ID, check number, etc." />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update Payment' : 'Log Payment'}
        </button>
      </div>
    </div>
  )
}
