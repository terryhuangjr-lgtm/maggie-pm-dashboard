import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBadge } from './ui/StatusBadge'
import { Modal } from './ui/Modal'
import { PropertyForm } from './PropertyForm'
import { Building2, MapPin, Plus, Pencil } from 'lucide-react'

interface Property {
  id: string
  address: string
  unit_number: string | null
  property_type: string
  bedrooms: number
  bathrooms: number
  square_footage: number | null
  owner_name: string
  status: string
  monthly_management_fee: number
  cc_payment_method: string | null
  cc_platform: string | null
  re_tax_schedule: string | null
}

interface LeaseInfo {
  tenant_name: string
  monthly_rent: number
  lease_end: string
  lease_status: string
}

export function PropertyList({ onViewProperty }: { onViewProperty: (id: string) => void }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [leaseMap, setLeaseMap] = useState<Record<string, LeaseInfo>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editProperty, setEditProperty] = useState<any>(null)

  useEffect(() => {
    loadProperties()
    const channel = supabase.channel('props-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, loadProperties)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadProperties() {
    try {
      const { data: props } = await supabase.from('properties').select('*').order('address')
      
      if (props) {
        setProperties(props)
        
        const { data: leases } = await supabase
          .from('leases')
          .select(`id, property_id, monthly_rent, lease_end, status, tenants (first_name, last_name)`)
          .eq('status', 'active')
        
        const lMap: Record<string, LeaseInfo> = {}
        if (leases) {
          for (const l of leases) {
            const t = l.tenants as any
            lMap[l.property_id] = {
              tenant_name: t ? `${t.first_name} ${t.last_name}` : '—',
              monthly_rent: l.monthly_rent,
              lease_end: l.lease_end,
              lease_status: l.status,
            }
          }
        }
        setLeaseMap(lMap)
      }
    } catch (err) {
      console.error('Failed to load properties:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all' 
    ? properties 
    : properties.filter(p => p.status === filter)

  const statusCounts = properties.reduce((acc: Record<string, number>, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1; return acc
  }, {})

  function handleEdit(p: any, e: React.MouseEvent) {
    e.stopPropagation()
    setEditProperty(p)
    setShowForm(true)
  }

  if (loading) return <div className="loading-state"><Building2 /> <p>Loading properties...</p></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Properties</h1>
          <p>{properties.length} total • {statusCounts.active || 0} active • {statusCounts.vacant || 0} vacant</p>
        </div>
        <button onClick={() => { setEditProperty(null); setShowForm(true) }} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={16} /> Add Property
        </button>
      </div>

      <div className="filter-bar">
        {['all', 'active', 'vacant', 'maintenance', 'listed_for_sale'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            {statusCounts[f] !== undefined && ` (${statusCounts[f]})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div className="empty-state"><MapPin /> <p>No properties found</p></div>
        )}
        {filtered.map(p => {
          const lease = leaseMap[p.id]
          return (
            <div
              key={p.id}
              className="property-card"
              onClick={() => onViewProperty(p.id)}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              <div className="property-card-top">
                <div>
                  <div className="property-card-address">
                    {p.address}{p.unit_number ? `, ${p.unit_number}` : ''}
                  </div>
                  <div className="property-card-sub">
                    <span>{p.property_type}</span>
                    <span>{p.bedrooms} bed / {p.bathrooms} bath {p.square_footage ? `/ ${p.square_footage} sqft` : ''}</span>
                    <span>Owner: {p.owner_name}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={(e) => handleEdit(p, e)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: 4, color: 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex'
                    }}
                    title="Edit property"
                  >
                    <Pencil size={14} />
                  </button>
                  {lease && (
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>
                      ${Number(lease.monthly_rent).toLocaleString()}/mo
                    </span>
                  )}
                  <StatusBadge status={p.status} />
                </div>
              </div>
              {lease && (
                <div className="property-card-sub">
                  <span>Tenant: {lease.tenant_name}</span>
                  <span>Lease ends: {new Date(lease.lease_end).toLocaleDateString()}</span>
                </div>
              )}
              <div className="property-card-sub" style={{ marginTop: 4 }}>
                {p.monthly_management_fee ? <span>Mgmt fee: ${Number(p.monthly_management_fee).toLocaleString()}/mo</span> : null}
                {p.cc_payment_method ? <span>Pay: {p.cc_payment_method}</span> : null}
                {p.cc_platform && !p.cc_platform.startsWith('http') ? <span>{p.cc_platform}</span> : null}
                {p.re_tax_schedule ? <span>Tax: {p.re_tax_schedule}</span> : null}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditProperty(null) }}
        title={editProperty ? 'Edit Property' : 'Add Property'} width="640px">
        <PropertyForm
          property={editProperty}
          onSaved={() => { setShowForm(false); setEditProperty(null); loadProperties() }}
          onCancel={() => { setShowForm(false); setEditProperty(null) }}
        />
      </Modal>
    </div>
  )
}
