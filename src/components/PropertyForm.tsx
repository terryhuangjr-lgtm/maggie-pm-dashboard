import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface PropertyFormProps {
  property?: any
  onSaved: () => void
  onCancel: () => void
}

const defaultProperty = {
  address: '', unit_number: '', city: 'New York', state: 'NY', zip_code: '',
  property_type: 'condo', bedrooms: '', bathrooms: '', square_footage: '',
  owner_name: '', owner_email: '', owner_phone: '', owner_language: 'English',
  purchase_date: '', purchase_price: '', current_market_value: '',
  monthly_management_fee: '', building_management_company: '',
  building_management_contact: '', status: 'active', notes: ''
}

export function PropertyForm({ property, onSaved, onCancel }: PropertyFormProps) {
  const isEdit = !!property
  const [form, setForm] = useState(property ? {
    ...property,
    bedrooms: property.bedrooms || '',
    bathrooms: property.bathrooms || '',
    square_footage: property.square_footage || '',
    purchase_price: property.purchase_price || '',
    current_market_value: property.current_market_value || '',
    monthly_management_fee: property.monthly_management_fee || '',
  } : defaultProperty)
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
        address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        property_type: form.property_type,
        owner_name: form.owner_name,
        status: form.status
      }
      if (form.unit_number) data.unit_number = form.unit_number
      if (form.bedrooms) data.bedrooms = parseInt(form.bedrooms)
      if (form.bathrooms) data.bathrooms = parseFloat(form.bathrooms)
      if (form.square_footage) data.square_footage = parseInt(form.square_footage)
      if (form.owner_email) data.owner_email = form.owner_email
      if (form.owner_phone) data.owner_phone = form.owner_phone
      if (form.owner_language) data.owner_language = form.owner_language
      if (form.purchase_date) data.purchase_date = form.purchase_date
      if (form.purchase_price) data.purchase_price = parseFloat(form.purchase_price)
      if (form.current_market_value) data.current_market_value = parseFloat(form.current_market_value)
      if (form.monthly_management_fee) data.monthly_management_fee = parseFloat(form.monthly_management_fee)
      if (form.building_management_company) data.building_management_company = form.building_management_company
      if (form.building_management_contact) data.building_management_contact = form.building_management_contact
      if (form.notes) data.notes = form.notes

      if (isEdit) {
        await supabase.from('properties').update(data).eq('id', property.id)
        await supabase.from('activity_log').insert({
          action: 'Property updated',
          details: `Updated ${form.address}`,
          source: 'manual'
        })
      } else {
        const { error: insertErr } = await supabase.from('properties').insert(data)
        if (insertErr) throw insertErr
        await supabase.from('activity_log').insert({
          action: 'Property added',
          details: `Added ${form.address}`,
          source: 'manual'
        })
      }
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save property')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Address *</label>
          <input style={fieldStyle} value={form.address} onChange={e => set('address', e.target.value)} required placeholder="123 Main Street" />
        </div>
        <div>
          <label style={labelStyle}>Unit</label>
          <input style={fieldStyle} value={form.unit_number} onChange={e => set('unit_number', e.target.value)} placeholder="3B" />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input style={fieldStyle} value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <input style={fieldStyle} value={form.state} onChange={e => set('state', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Zip Code</label>
          <input style={fieldStyle} value={form.zip_code} onChange={e => set('zip_code', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Property Type</label>
          <select style={fieldStyle} value={form.property_type} onChange={e => set('property_type', e.target.value)}>
            <option value="condo">Condo</option>
            <option value="co-op">Co-op</option>
            <option value="house">House</option>
            <option value="townhouse">Townhouse</option>
            <option value="multi-family">Multi-Family</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Bedrooms</label>
          <input style={fieldStyle} type="number" value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Bathrooms</label>
          <input style={fieldStyle} type="number" step="0.5" value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Sq Ft</label>
          <input style={fieldStyle} type="number" value={form.square_footage} onChange={e => set('square_footage', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="vacant">Vacant</option>
            <option value="maintenance">Maintenance</option>
            <option value="listed_for_sale">Listed for Sale</option>
          </select>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Owner Info</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Owner Name *</label>
          <input style={fieldStyle} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Owner Email</label>
          <input style={fieldStyle} type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Owner Phone</label>
          <input style={fieldStyle} value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Language</label>
          <select style={fieldStyle} value={form.owner_language} onChange={e => set('owner_language', e.target.value)}>
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
            <option value="Korean">Korean</option>
            <option value="Japanese">Japanese</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Purchase Date</label>
          <input style={fieldStyle} type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Purchase Price</label>
          <input style={fieldStyle} type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="$" />
        </div>
        <div>
          <label style={labelStyle}>Market Value</label>
          <input style={fieldStyle} type="number" value={form.current_market_value} onChange={e => set('current_market_value', e.target.value)} placeholder="$" />
        </div>
        <div>
          <label style={labelStyle}>Mgmt Fee/Month</label>
          <input style={fieldStyle} type="number" value={form.monthly_management_fee} onChange={e => set('monthly_management_fee', e.target.value)} placeholder="$" />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      <div>
        <label style={labelStyle}>Building Management</label>
        <input style={fieldStyle} value={form.building_management_company} onChange={e => set('building_management_company', e.target.value)} placeholder="Company name" />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Contact</label>
        <input style={fieldStyle} value={form.building_management_contact} onChange={e => set('building_management_contact', e.target.value)} placeholder="Phone or name" />
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
          {saving ? 'Saving...' : isEdit ? 'Update Property' : 'Add Property'}
        </button>
      </div>
    </form>
  )
}
