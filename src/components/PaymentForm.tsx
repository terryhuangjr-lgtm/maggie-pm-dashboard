import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface PaymentFormProps {
  propertyId: string
  leaseId: string
  tenantId?: string | null
  rentAmount: number
  onSaved: () => void
  onCancel: () => void
}

export function PaymentForm({ propertyId, leaseId, tenantId, rentAmount, onSaved, onCancel }: PaymentFormProps) {
  const [form, setForm] = useState({
    amount: rentAmount.toString(),
    payment_type: 'rent',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Zelle',
    status: 'received',
    notes: ''
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function handleSave() {
    if (!form.amount) return alert('Amount is required')
    setLoading(true)

    try {
      // Calculate due date (first of the current month)
      const now = new Date()
      const dueDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

      const { error } = await supabase.from('payments').insert([{
        property_id: propertyId,
        lease_id: leaseId,
        tenant_id: tenantId || null,
        amount: parseFloat(form.amount),
        payment_type: form.payment_type,
        payment_date: form.payment_date,
        due_date: dueDate,
        payment_method: form.payment_method,
        status: form.status,
        notes: form.notes || null
      }])

      if (error) throw error

      await supabase.from('activity_log').insert({
        property_id: propertyId,
        tenant_id: tenantId || null,
        action: 'Payment received',
        details: `$${parseFloat(form.amount).toLocaleString()} logged via ${form.payment_method}`,
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

      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea style={fieldStyle} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Transaction ID, check number, etc." />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Log Payment'}
        </button>
      </div>
    </div>
  )
}
