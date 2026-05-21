import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Phone, Mail, Building2, Star, Search, ChevronDown, User, Wrench, HardHat, Shield, Briefcase, Building, Scale, BookOpen, MoreHorizontal, Plus } from 'lucide-react'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  role: string
  company: string | null
  property_id: string | null
  property_address: string | null
  property_unit: string | null
  language_preference: string
  notes: string | null
  is_favorite: boolean
  status: string
  created_at: string
}

interface PropertyOption {
  id: string
  address: string
  unit_number: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  tenant: 'Tenant',
  contractor: 'Contractor',
  building_manager: 'Building Manager',
  handyman: 'Handyman',
  plumber: 'Plumber',
  electrician: 'Electrician',
  attorney: 'Attorney',
  accountant: 'Accountant',
  insurance: 'Insurance',
  board_member: 'Board Member',
  other: 'Other',
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Building2 size={16} />,
  tenant: <User size={16} />,
  contractor: <HardHat size={16} />,
  building_manager: <Building size={16} />,
  handyman: <Wrench size={16} />,
  plumber: <Wrench size={16} />,
  electrician: <Wrench size={16} />,
  attorney: <Scale size={16} />,
  accountant: <Briefcase size={16} />,
  insurance: <Shield size={16} />,
  board_member: <BookOpen size={16} />,
  other: <MoreHorizontal size={16} />,
}

const ROLE_ORDER = [
  'owner', 'tenant', 'building_manager', 'contractor',
  'handyman', 'plumber', 'electrician',
  'attorney', 'accountant', 'insurance', 'board_member', 'other'
]
const allRoles = Object.keys(ROLE_LABELS)

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [expandedContact, setExpandedContact] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [saveError, setSaveError] = useState('')

  // Add contact form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'tenant',
    company: '',
    property_id: '',
    language_preference: 'English',
    notes: '',
    is_favorite: false,
  })

  useEffect(() => {
    loadContacts()
    loadProperties()
  }, [])

  async function loadContacts() {
    try {
      const { data } = await supabase
        .from('contacts_with_property')
        .select('*')
        .eq('status', 'active')
        .order('role', { ascending: true })
        .order('last_name', { ascending: true })
      setContacts(data || [])
    } catch (err) {
      console.error('Failed to load contacts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadProperties() {
    try {
      const { data } = await supabase
        .from('properties')
        .select('id, address, unit_number')
        .order('address', { ascending: true })
      setProperties(data || [])
    } catch (err) {
      console.error('Failed to load properties:', err)
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setSaveError('First and last name are required')
      return
    }

    try {
      const payload: any = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role,
        language_preference: form.language_preference,
        is_favorite: form.is_favorite,
        status: 'active',
      }
      if (form.email) payload.email = form.email.trim()
      if (form.phone) payload.phone = form.phone.trim()
      if (form.company) payload.company = form.company.trim()
      if (form.property_id) payload.property_id = form.property_id
      if (form.notes) payload.notes = form.notes.trim()

      const { error } = await supabase.from('contacts').insert(payload)
      if (error) throw error

      await supabase.from('activity_log').insert({
        action: 'Contact added',
        details: `Added contact: ${form.first_name} ${form.last_name} (${ROLE_LABELS[form.role] || form.role})`,
        source: 'manual',
      })

      setShowAddModal(false)
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'tenant',
        company: '',
        property_id: '',
        language_preference: 'English',
        notes: '',
        is_favorite: false,
      })
      await loadContacts()
    } catch (err: any) {
      setSaveError(err.message || 'Failed to add contact')
    }
  }

  function set(field: string, value: string | boolean) {
    setForm({ ...form, [field]: value })
  }

  const filtered = contacts.filter(c => {
    const matchRole = !selectedRole || c.role === selectedRole
    if (!search) return matchRole
    const q = search.toLowerCase()
    const name = `${c.first_name} ${c.last_name}`.toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    const email = (c.email || '').toLowerCase()
    const company = (c.company || '').toLowerCase()
    const notes = (c.notes || '').toLowerCase()
    return matchRole && (name.includes(q) || phone.includes(q) || email.includes(q) || company.includes(q) || notes.includes(q))
  })

  // Group by role
  const grouped: Record<string, Contact[]> = {}
  for (const role of ROLE_ORDER) {
    const roleContacts = filtered.filter(c => c.role === role)
    if (roleContacts.length > 0) {
      grouped[role] = roleContacts
    }
  }
  for (const c of filtered) {
    if (!grouped[c.role]) grouped[c.role] = []
    if (!grouped[c.role].some(existing => existing.id === c.id)) {
      grouped[c.role].push(c)
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'var(--font-body)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4, display: 'block',
  }

  return (
    <div>
      <div className="page-header">
        <h1>Contacts</h1>
        <p>Property management directory — owners, tenants, vendors, and more</p>
      </div>

      {/* Search + Filter + Add button */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <button
          className={`filter-btn ${!selectedRole ? 'active' : ''}`}
          onClick={() => setSelectedRole(null)}
        >
          All ({contacts.length})
        </button>
        {allRoles.map(role => {
          const count = contacts.filter(c => c.role === role).length
          if (count === 0) return null
          return (
            <button
              key={role}
              className={`filter-btn ${selectedRole === role ? 'active' : ''}`}
              onClick={() => setSelectedRole(selectedRole === role ? null : role)}
            >
              {role.replace(/_/g, ' ')} ({count})
            </button>
          )
        })}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 600,
            fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={15} /> Add Contact
        </button>
      </div>

      {/* Contacts by Role */}
      {loading ? (
        <div className="loading-state"><p>Loading contacts...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>No contacts found{search ? ` matching "${search}"` : ''}</p></div>
      ) : (
        Object.entries(grouped).map(([role, roleContacts]) => (
          <div key={role} style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {ROLE_ICONS[role] || <MoreHorizontal size={16} />}
              {ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                ({roleContacts.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roleContacts.map(c => (
                <div
                  key={c.id}
                  className="property-card"
                  onClick={() => setExpandedContact(expandedContact === c.id ? null : c.id)}
                  style={{ cursor: 'pointer', padding: '14px 20px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.is_favorite && <Star size={14} fill="var(--accent)" color="var(--accent)" />}
                      <span className="property-card-address" style={{ fontSize: 15 }}>
                        {c.first_name} {c.last_name}
                      </span>
                      {c.company && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          — {c.company}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={13} /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={13} />
                        </a>
                      )}
                      <ChevronDown size={16}
                        style={{
                          color: 'var(--text-muted)',
                          transform: expandedContact === c.id ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    </div>
                  </div>

                  {expandedContact === c.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
                      {c.phone && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</span>
                          <div style={{ marginTop: 2 }}><a href={`tel:${c.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{c.phone}</a></div>
                        </div>
                      )}
                      {c.email && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</span>
                          <div style={{ marginTop: 2 }}><a href={`mailto:${c.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{c.email}</a></div>
                        </div>
                      )}
                      {c.company && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Company</span>
                          <div style={{ marginTop: 2 }}>{c.company}</div>
                        </div>
                      )}
                      {c.property_address && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Property</span>
                          <div style={{ marginTop: 2 }}>{c.property_address}{c.property_unit ? ` ${c.property_unit}` : ''}</div>
                        </div>
                      )}
                      {c.language_preference && c.language_preference !== 'English' && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Language</span>
                          <div style={{ marginTop: 2 }}>{c.language_preference}</div>
                        </div>
                      )}
                      {c.notes && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</span>
                          <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{c.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add Contact Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Contact" width="520px">
        <form onSubmit={handleAddContact}>
          {saveError && (
            <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input style={fieldStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" required />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input style={fieldStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Doe" required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={fieldStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={fieldStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(212) 555-0123" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={fieldStyle} value={form.role} onChange={e => set('role', e.target.value)}>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input style={fieldStyle} value={form.company} onChange={e => set('company', e.target.value)} placeholder="Company name" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Property (optional)</label>
              <select style={fieldStyle} value={form.property_id} onChange={e => set('property_id', e.target.value)}>
                <option value="">— No property —</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.address}{p.unit_number ? ` #${p.unit_number}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <select style={fieldStyle} value={form.language_preference} onChange={e => set('language_preference', e.target.value)}>
                <option value="English">English</option>
                <option value="Chinese">Chinese</option>
                <option value="Chinese / English">Chinese / English</option>
                <option value="Korean">Korean</option>
                <option value="Spanish">Spanish</option>
                <option value="Russian">Russian</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={form.is_favorite}
                  onChange={e => set('is_favorite', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                Mark as favorite
              </label>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this contact..." />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="filter-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600,
              fontSize: 13, cursor: 'pointer',
            }}>
              Add Contact
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
