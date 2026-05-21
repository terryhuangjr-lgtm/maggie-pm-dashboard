import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatCard } from './ui/StatCard'
import { StatusBadge } from './ui/StatusBadge'
import { Home, TrendingUp, AlertTriangle, Calendar, Clock, CheckCircle, Building2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { PaymentForm } from './PaymentForm'
import { useAuth } from '../lib/AuthContext'

interface DashboardData {
  totalProperties: number
  occupiedUnits: number
  totalUnits: number
  portfolioValue: number
  monthlyRentExpected: number
  monthlyRentCollected: number
  paymentsReceived: number
  paymentsPending: number
  paymentsLate: number
  openTasks: number
  urgentTasks: number
  upcomingExpirations: any[]
  recentActivity: any[]
  rentStatus: any[]
  openTasksList: any[]
}

export function Dashboard(_props: { onViewProperty?: (id: string) => void }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [data, setData] = useState<DashboardData>({
    totalProperties: 0, occupiedUnits: 0, totalUnits: 0, portfolioValue: 0,
    monthlyRentExpected: 0, monthlyRentCollected: 0,
    paymentsReceived: 0, paymentsPending: 0, paymentsLate: 0,
    openTasks: 0, urgentTasks: 0,
    upcomingExpirations: [], recentActivity: [], rentStatus: [], openTasksList: []
  })
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentLeaseContext, setPaymentLeaseContext] = useState<{propertyId: string, leaseId: string, tenantId: string | null, rent: number} | null>(null)

  useEffect(() => {
    loadData()
    // Subscribe to realtime changes
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadData() {
    try {
      const [properties, leases, payments, tasks, activity, expirations, rentStatus, openTasksList] = await Promise.all([
        supabase.from('properties').select('*'),
        supabase.from('leases').select('*').eq('status', 'active'),
        supabase.from('payments').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('upcoming_lease_expirations').select('*').order('days_until_expiry', { ascending: true }),
        supabase.from('monthly_rent_status').select('*'),
        supabase.from('open_tasks_by_priority').select('*'),
      ])

      const props = properties.data || []
      const activeLeases = leases.data || []
      const allPayments = payments.data || []
      const allTasks = tasks.data || []

      // Rent calculations
      const portfolioValue = props.reduce((sum: number, p: any) => sum + Number(p.current_market_value || p.purchase_price || 0), 0)
      const monthlyRentExpected = activeLeases.reduce((sum: number, l: any) => sum + Number(l.monthly_rent || 0), 0)
      
      // Get all payments for THIS month to accurately count what's collected
      const now = new Date()
      const thisMonthPayments = allPayments.filter(p => {
        if (!p.due_date) return false
        const d = new Date(p.due_date)
        // Convert to UTC to avoid timezone issues when checking month
        const dueMonth = d.getUTCMonth()
        const dueYear = d.getUTCFullYear()
        return dueMonth === now.getMonth() && dueYear === now.getFullYear()
      })
      
      const receivedPayments = thisMonthPayments.filter(p => p.status === 'received')
      const monthlyRentCollected = receivedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

      setData({
        totalProperties: props.length,
        occupiedUnits: activeLeases.length,
        totalUnits: props.reduce((sum: number, p: any) => sum + (p.bedrooms || 1), 0),
        portfolioValue,
        monthlyRentExpected,
        monthlyRentCollected,
        paymentsReceived: rentStatus.data?.filter(r => r.payment_status === 'received').length || 0,
        paymentsPending: rentStatus.data?.filter(r => !r.payment_status).length || 0,
        paymentsLate: allPayments.filter(p => p.status === 'late').length,
        openTasks: allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
        urgentTasks: allTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length,
        upcomingExpirations: expirations.data || [],
        recentActivity: activity.data || [],
        rentStatus: rentStatus.data || [],
        openTasksList: openTasksList.data || [],
      })
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading-state"><Clock /> <p>Loading dashboard...</p></div>
  }

  const occupancyRate = data.totalProperties > 0
    ? Math.round((data.occupiedUnits / data.totalProperties) * 100)
    : 0

  const expirationsSoon = data.upcomingExpirations.filter(e => e.days_until_expiry <= 30)
  // const expirationsMedium = data.upcomingExpirations.filter(e => e.days_until_expiry > 30 && e.days_until_expiry <= 60)

  return (
    <div>
      <div className="page-header">
        <h1>Overview Dashboard</h1>
        <p>MH Group — Property Management Portfolio</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Properties"
          value={data.totalProperties}
          icon={<Home />}
          iconBg="rgba(16, 185, 129, 0.15)"
          change={`${occupancyRate}% occupied`}
        />
        {isAdmin && (
        <StatCard
          label="Portfolio Value"
          value={`$${(data.portfolioValue / 1000000).toFixed(1)}M`}
          icon={<Building2 />}
          iconBg="rgba(139, 92, 246, 0.15)"
          change={`${data.totalUnits} units total`}
        />
        )}
        {isAdmin && (
        <StatCard
          label="Monthly Rent"
          value={`$${(data.monthlyRentExpected || 0).toLocaleString()}`}
          icon={<TrendingUp />}
          iconBg="rgba(59, 130, 246, 0.15)"
          change={`$${(data.monthlyRentCollected || 0).toLocaleString()} collected`}
          changeType={data.monthlyRentCollected >= data.monthlyRentExpected * 0.9 ? 'positive' : 'negative'}
        />
        )}
        <StatCard
          label="Open Tasks"
          value={data.openTasks}
          icon={<ListTodo />}
          iconBg="rgba(245, 158, 11, 0.15)"
          change={`${data.urgentTasks} urgent`}
          changeType={data.urgentTasks > 0 ? 'negative' : 'positive'}
        />
        <StatCard
          label="Upcoming Expirations"
          value={data.upcomingExpirations.length}
          icon={<Calendar />}
          iconBg="rgba(239, 68, 68, 0.15)"
          change={`${expirationsSoon.length} within 30 days`}
          changeType={expirationsSoon.length > 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="dashboard-grid">
        {/* Lease Expirations */}
        <div className="card">
          <div className="card-header">
            <h3>Lease Expirations — Next 90 Days</h3>
          </div>
          <div className="card-body">
            {data.upcomingExpirations.length === 0 ? (
              <div className="empty-state"><CheckCircle /> <p>No leases expiring soon</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Tenant</th>
                    {isAdmin && <th>Rent</th>}
                    <th>Expires</th>
                    <th>Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcomingExpirations.map((e: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{e.address}{e.unit_number ? ` ${e.unit_number}` : ''}</td>
                      <td>
                        <div>{e.tenant_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.tenant_phone}</div>
                      </td>
                      {isAdmin && <td>{Number(e.monthly_rent || 0).toLocaleString()}</td>}
                      <td>{new Date(e.lease_end).toLocaleDateString()}</td>
                      <td>
                        <span style={{
                          color: e.days_until_expiry <= 30 ? 'var(--red)' :
                                 e.days_until_expiry <= 60 ? 'var(--yellow)' : 'var(--green)',
                          fontWeight: 600
                        }}>
                          {e.days_until_expiry} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Rent Status */}
        <div className="card">
          <div className="card-header">
            <h3>Rent Status — This Month</h3>
          </div>
          <div className="card-body">
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
              <StatCard label="Paid" value={data.paymentsReceived} icon={<CheckCircle />} iconBg="rgba(16, 185, 129, 0.15)" />
              <StatCard label="Pending" value={data.paymentsPending} icon={<Clock />} iconBg="rgba(245, 158, 11, 0.15)" />
              <StatCard label="Late" value={data.paymentsLate} icon={<AlertTriangle />} iconBg="rgba(239, 68, 68, 0.15)" />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Rent</th>
                  <th>Due Day</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rentStatus.slice(0, 10).map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{r.address}{r.unit_number ? ` ${r.unit_number}` : ''}</td>
                    <td>{r.tenant_name}</td>
                    <td>${Number(r.monthly_rent || 0).toLocaleString()}</td>
                    <td>{r.rent_due_day}</td>
                    <td>
                      {r.payment_status
                        ? <StatusBadge status={r.payment_status} />
                        : <StatusBadge status="pending" />
                      }
                    </td>
                    <td>
                      {r.payment_status !== 'received' ? (
                        <button 
                          className="btn" 
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => {
                            setPaymentLeaseContext({
                              propertyId: r.property_id,
                              leaseId: r.lease_id,
                              tenantId: r.tenant_id,
                              rent: Number(r.monthly_rent || 0)
                            })
                            setShowPaymentForm(true)
                          }}
                        >
                          Log Payment
                        </button>
                      ) : (
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)' }}
                          onClick={async () => {
                            if (!r.payment_id || !confirm('Undo this payment?')) return;
                            try {
                              await supabase.from('payments').delete().eq('id', r.payment_id);
                              await supabase.from('activity_log').insert({
                                property_id: r.property_id,
                                tenant_id: r.tenant_id,
                                action: 'Payment reversed',
                                details: 'Payment was undone manually',
                                source: 'manual'
                              });
                              loadData();
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Open Tasks */}
        <div className="card">
          <div className="card-header">
            <h3>Open Tasks by Priority</h3>
          </div>
          <div className="card-body">
            {data.openTasksList.length === 0 ? (
              <div className="empty-state"><CheckCircle /> <p>No open tasks</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Task</th>
                    <th>Property</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openTasksList.slice(0, 8).map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <span className={`priority-dot priority-${t.priority}`} />
                        {t.priority}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.task_type?.replace(/_/g, ' ')}</div>
                      </td>
                      <td>{t.address || '—'}</td>
                      <td style={{ color: t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'var(--red)' : 'inherit' }}>
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body">
            {data.recentActivity.length === 0 ? (
              <div className="empty-state"><Clock /> <p>No recent activity</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Source</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((a: any) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.action}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.details || '—'}
                      </td>
                      <td><StatusBadge status={a.source || 'system'} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {/* Modals */}
      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Log Payment" width="480px">
        {paymentLeaseContext && (
          <PaymentForm 
            propertyId={paymentLeaseContext.propertyId}
            leaseId={paymentLeaseContext.leaseId}
            tenantId={paymentLeaseContext.tenantId}
            rentAmount={paymentLeaseContext.rent}
            onSaved={() => {
              setShowPaymentForm(false)
              loadData()
            }}
            onCancel={() => setShowPaymentForm(false)}
          />
        )}
      </Modal>

    </div>
  )
}

function ListTodo({ size }: { size?: number }) {
  return <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
}
