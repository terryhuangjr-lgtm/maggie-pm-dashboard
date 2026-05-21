import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBadge } from './ui/StatusBadge'
import { Modal } from './ui/Modal'
import { PropertyForm } from './PropertyForm'
import { TenantForm } from './TenantForm'
import { LeaseForm } from './LeaseForm'
import { PaymentForm } from './PaymentForm'
import { ChevronLeft, MapPin, Building2, Plus, Pencil, CheckCircle, Upload, FileText } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

interface FullProperty {
  id: string
  address: string
  unit_number: string | null
  city: string
  state: string
  property_type: string
  bedrooms: number
  bathrooms: number
  square_footage: number | null
  owner_name: string
  owner_email: string | null
  owner_phone: string | null
  status: string
  monthly_management_fee: number
  notes: string | null
  cc_payment_method: string | null
  cc_platform: string | null
  electric_billing: string | null
  e_bill_platform: string | null
  re_tax_schedule: string | null
  lease_term_display: string | null
  lease_document_url: string | null
  renewal_notice_date: string | null
  lease_start: string | null
  lease_end: string | null
}

interface TenantInfo {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  move_in_date: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

interface LeaseInfo {
  id: string
  lease_start: string
  lease_end: string
  monthly_rent: number
  security_deposit: number | null
  rent_due_day: number
  status: string
}

export function PropertyDetail({ propertyId, onBack }: { propertyId: string, onBack: () => void }) {
  const [property, setProperty] = useState<FullProperty | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [lease, setLease] = useState<LeaseInfo | null>(null)
  const [allTenants, setAllTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showPropForm, setShowPropForm] = useState(false)
  const [showTenantForm, setShowTenantForm] = useState(false)
  const [editTenant, setEditTenant] = useState<any>(null)
  const [showLeaseForm, setShowLeaseForm] = useState(false)
  const [editLease, setEditLease] = useState<any>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState('')
  const [dropboxFiles, setDropboxFiles] = useState<any[]>([])
  const [filesLoading, setFilesLoading] = useState(true)

  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  useEffect(() => { loadProperty() }, [propertyId])

  async function loadProperty() {
    try {
      const { data: props } = await supabase.from('properties').select('*').eq('id', propertyId).single()
      if (props) {
        setProperty(props)

        const { data: tenantsData } = await supabase.from('tenants').select('*').eq('property_id', propertyId)
        if (tenantsData) setAllTenants(tenantsData)

        const { data: leasesData } = await supabase
          .from('leases')
          .select('*')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (leasesData) {
          setLease(leasesData)
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', leasesData.tenant_id)
            .single()
          if (tenantData) setTenant(tenantData)
        }
      }
    } catch (err) {
      console.error('Failed to load property:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDropboxFiles() {
    if (!property) return
    setFilesLoading(true)
    try {
      const API = import.meta.env.DEV ? 'http://localhost:3000' : ''
      const folderName = `${property.address}${property.unit_number ? ` #${property.unit_number.trim()}` : ''}`
      const res = await fetch(`${API}/api/dropbox-list?property=${encodeURIComponent(folderName)}`)
      if (res.ok) {
        const data = await res.json()
        setDropboxFiles(data.entries || [])
      }
    } catch (err) {
      console.error('Failed to load Dropbox files:', err)
    } finally {
      setFilesLoading(false)
    }
  }

  useEffect(() => { loadDropboxFiles() }, [property])

  async function handleFileUpload(file: File | undefined | null) {
    if (!file || !property) return
    setUploading(true)
    setUploadProgress(0)
    setUploadResult(null)
    setUploadError('')

    try {
      const folderName = `${property.address}${property.unit_number ? ` #${property.unit_number.trim()}` : ''}`
      const formData = new FormData()
      formData.append('file', file)
      formData.append('property', folderName)
      formData.append('category', 'Documents')

      const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

      const res = await fetch(`${API}/api/dropbox-upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const result = await res.json()
      setUploadResult(result)

      await supabase.from('activity_log').insert({
        property_id: propertyId,
        action: 'File uploaded',
        details: `Uploaded ${file.name} to Dropbox`,
        source: 'manual'
      })
      loadDropboxFiles()
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="loading-state"><Building2 /> <p>Loading property details...</p></div>
  if (!property) return <div className="error-state"><MapPin /> <p>Property not found</p></div>

  return (
    <div>
      <button className="nav-item" onClick={onBack} style={{ width: 'auto', marginBottom: 16 }}>
        <ChevronLeft size={18} /> Back to Properties
      </button>

      <div className="detail-header">
        <div>
          <h2>{property.address}{property.unit_number ? `, ${property.unit_number}` : ''}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {property.city}, {property.state} • {property.property_type} • {property.bedrooms} bed / {property.bathrooms} bath {property.square_footage ? `• ${property.square_footage} sqft` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowPropForm(true)} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12
          }}>
            <Pencil size={14} /> Edit
          </button>
          <StatusBadge status={property.status} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><h3>Property Information</h3></div>
          <div className="card-body">
            <div className="detail-field">
              <div className="detail-field-label">Property Type</div>
              <div className="detail-field-value">{property.property_type}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Bedrooms / Bathrooms</div>
              <div className="detail-field-value">{property.bedrooms} bed / {property.bathrooms} bath</div>
            </div>
            {isAdmin && (
              <div className="detail-field">
                <div className="detail-field-label">Management Fee</div>
                <div className="detail-field-value">${Number(property.monthly_management_fee || 0).toLocaleString()}/mo</div>
              </div>
            )}
            {property.notes && (
              <div className="detail-field">
                <div className="detail-field-label">Notes</div>
                <div className="detail-field-value">{property.notes}</div>
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
        <div className="card">
          <div className="card-header"><h3>Owner Information</h3></div>
          <div className="card-body">
            <div className="detail-field">
              <div className="detail-field-label">Name</div>
              <div className="detail-field-value">{property.owner_name}</div>
            </div>
            {property.owner_email && (
              <div className="detail-field">
                <div className="detail-field-label">Email</div>
                <div className="detail-field-value">{property.owner_email}</div>
              </div>
            )}
            {property.owner_phone && (
              <div className="detail-field">
                <div className="detail-field-label">Phone</div>
                <div className="detail-field-value">{property.owner_phone}</div>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="card">
          <div className="card-header"><h3>Billing & Utilities</h3></div>
          <div className="card-body">
            {property.cc_payment_method && (
              <div className="detail-field">
                <div className="detail-field-label">CC Payment Method</div>
                <div className="detail-field-value">{property.cc_payment_method}</div>
              </div>
            )}
            {property.cc_platform && (
              <div className="detail-field">
                <div className="detail-field-label">CC Platform</div>
                <div className="detail-field-value">{property.cc_platform}</div>
              </div>
            )}
            {property.electric_billing && (
              <div className="detail-field">
                <div className="detail-field-label">Electric Billing</div>
                <div className="detail-field-value">{property.electric_billing}</div>
              </div>
            )}
            {property.e_bill_platform && (
              <div className="detail-field">
                <div className="detail-field-label">E-Bill Platform</div>
                <div className="detail-field-value">{property.e_bill_platform}</div>
              </div>
            )}
            {property.re_tax_schedule && (
              <div className="detail-field">
                <div className="detail-field-label">RE Tax Schedule</div>
                <div className="detail-field-value">{property.re_tax_schedule}</div>
              </div>
            )}
            {property.lease_term_display && (
              <div className="detail-field">
                <div className="detail-field-label">Lease Term</div>
                <div className="detail-field-value">{property.lease_term_display}</div>
              </div>
            )}
            {property.lease_start && (
              <div className="detail-field">
                <div className="detail-field-label">Lease Start</div>
                <div className="detail-field-value">{new Date(property.lease_start).toLocaleDateString()}</div>
              </div>
            )}
            {property.lease_end && (
              <div className="detail-field">
                <div className="detail-field-label">Lease End</div>
                <div className="detail-field-value" style={{
                  color: new Date(property.lease_end) < new Date() ? 'var(--red)' :
                         new Date(property.lease_end) < new Date(Date.now() + 30*24*60*60*1000) ? 'var(--yellow)' : 'inherit',
                  fontWeight: new Date(property.lease_end) < new Date() ? 600 : 'normal'
                }}>
                  {new Date(property.lease_end).toLocaleDateString()}
                  {new Date(property.lease_end) < new Date() ? ' (EXPIRED)' : ''}
                </div>
              </div>
            )}
            {property.renewal_notice_date && (
              <div className="detail-field">
                <div className="detail-field-label">Renewal Notice Date</div>
                <div className="detail-field-value">{new Date(property.renewal_notice_date).toLocaleDateString()}</div>
              </div>
            )}
            {property.lease_document_url && (
              <div className="detail-field">
                <div className="detail-field-label">Lease Document</div>
                <div className="detail-field-value">
                  <a href={property.lease_document_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    View Lease
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3> Tenant</h3>
            <button onClick={() => { setEditTenant(null); setShowTenantForm(true) }} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11
            }}>
              <Plus size={12} /> Add Tenant
            </button>
          </div>
          <div className="card-body">
            {tenant ? (
              <>
                <div className="detail-field">
                  <div className="detail-field-label">Name</div>
                  <div className="detail-field-value">
                    {tenant.first_name} {tenant.last_name}
                    <button onClick={() => { setEditTenant(tenant); setShowTenantForm(true) }} style={{
                      background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                      marginLeft: 8, fontSize: 11
                    }}>Edit</button>
                  </div>
                </div>
                {tenant.email && (
                  <div className="detail-field">
                    <div className="detail-field-label">Email</div>
                    <div className="detail-field-value">{tenant.email}</div>
                  </div>
                )}
                {tenant.phone && (
                  <div className="detail-field">
                    <div className="detail-field-label">Phone</div>
                    <div className="detail-field-value">{tenant.phone}</div>
                  </div>
                )}
                {tenant.move_in_date && (
                  <div className="detail-field">
                    <div className="detail-field-label">Move In Date</div>
                    <div className="detail-field-value">{new Date(tenant.move_in_date).toLocaleDateString()}</div>
                  </div>
                )}
                {tenant.emergency_contact_name && (
                  <div className="detail-field">
                    <div className="detail-field-label">Emergency Contact</div>
                    <div className="detail-field-value">{tenant.emergency_contact_name} {tenant.emergency_contact_phone ? `(${tenant.emergency_contact_phone})` : ''}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tenant assigned</p>
              </div>
            )}
            {allTenants.length > 1 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                {allTenants.length - 1} other tenant{allTenants.length - 1 > 1 ? 's' : ''} on record
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Lease</h3>
            <button onClick={() => { setEditLease(null); setShowLeaseForm(true) }} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11
            }}>
              <Plus size={12} /> New Lease
            </button>
          </div>
          <div className="card-body">
            {lease ? (
              <>
                {isAdmin && (
                <div className="detail-field">
                  <div className="detail-field-label">Monthly Rent</div>
                  <div className="detail-field-value" style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
                    ${Number(lease.monthly_rent).toLocaleString()}/mo
                    <button onClick={() => { setEditLease(lease); setShowLeaseForm(true) }} style={{
                      background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                      marginLeft: 8, fontSize: 11
                    }}>Edit</button>
                  </div>
                </div>
                )}
                <div className="detail-field">
                  <div className="detail-field-label">Lease Period</div>
                  <div className="detail-field-value">
                    {new Date(lease.lease_start).toLocaleDateString()} — {new Date(lease.lease_end).toLocaleDateString()}
                  </div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">Rent Due Day</div>
                  <div className="detail-field-value">{lease.rent_due_day}th of each month</div>
                </div>
                {isAdmin && lease.security_deposit && (
                  <div className="detail-field">
                    <div className="detail-field-label">Security Deposit</div>
                    <div className="detail-field-value">${Number(lease.security_deposit).toLocaleString()}</div>
                  </div>
                )}
                <div className="detail-field">
                  <div className="detail-field-label">Status</div>
                  <div className="detail-field-value"><StatusBadge status={lease.status} /></div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">Lease Expires</div>
                  <div className="detail-field-value" style={{
                    color: new Date(lease.lease_end) < new Date() ? 'var(--red)' :
                           new Date(lease.lease_end) < new Date(Date.now() + 30*24*60*60*1000) ? 'var(--yellow)' : 'inherit'
                  }}>
                    {new Date(lease.lease_end).toLocaleDateString()}
                    {new Date(lease.lease_end) < new Date() ? ' (EXPIRED)' : ''}
                  </div>
                </div>

                {isAdmin && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8 }}
                    onClick={() => setShowPaymentForm(true)}
                  >
                    <CheckCircle size={16} /> Log Rent Payment
                  </button>
                </div>
                )}
              </>
            ) : (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active lease</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Files</h3></div>
          <div className="card-body">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Upload files to this property's Dropbox folder.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
              }}>
                <Upload size={14} /> Upload File
                <input type="file" style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e.target.files?.[0])} />
              </label>
            </div>
            {uploading && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Uploading... {uploadProgress > 0 && `${uploadProgress}%`}
              </div>
            )}
            {uploadResult && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--green)' }}>
                ✓ Uploaded
                {uploadResult.url && (
                  <a href={uploadResult.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', marginLeft: 8 }}>
                    <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    View
                  </a>
                )}
              </div>
            )}
            {uploadError && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
                ✗ {uploadError}
              </div>
            )}

            {filesLoading ? (
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                Loading files...
              </div>
            ) : dropboxFiles.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Existing Files
                </div>
                {dropboxFiles.map((file: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                    fontSize: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{file.name}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal open={showPropForm} onClose={() => setShowPropForm(false)} title="Edit Property" width="640px">
        <PropertyForm property={property} onSaved={() => { setShowPropForm(false); loadProperty() }} onCancel={() => setShowPropForm(false)} />
      </Modal>

      <Modal open={showTenantForm} onClose={() => { setShowTenantForm(false); setEditTenant(null) }}
        title={editTenant ? 'Edit Tenant' : 'Add Tenant'}>
        <TenantForm propertyId={propertyId} tenant={editTenant}
          onSaved={() => { setShowTenantForm(false); setEditTenant(null); loadProperty() }}
          onCancel={() => { setShowTenantForm(false); setEditTenant(null) }} />
      </Modal>

      <Modal open={showLeaseForm} onClose={() => { setShowLeaseForm(false); setEditLease(null) }}
        title={editLease ? 'Edit Lease' : 'New Lease'} width="560px">
        <LeaseForm propertyId={propertyId} tenants={allTenants} lease={editLease}
          onSaved={() => { setShowLeaseForm(false); setEditLease(null); loadProperty() }}
          onCancel={() => { setShowLeaseForm(false); setEditLease(null) }} />
      </Modal>

      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Log Payment" width="480px">
        {lease && (
          <PaymentForm
            propertyId={propertyId}
            leaseId={lease.id}
            tenantId={tenant?.id || null}
            rentAmount={lease.monthly_rent}
            onSaved={() => {
              setShowPaymentForm(false)
              loadProperty()
            }}
            onCancel={() => setShowPaymentForm(false)}
          />
        )}
      </Modal>
    </div>
  )
}
