import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

interface PnLRow {
  property_id: string
  address: string
  unit_number: string | null
  month_key: string
  rental_income: number
  mgmt_fee_expense: number
  maintenance_cost: number
  tax_expense: number
  insurance_cost: number
  utilities_cost: number
  cc_expense: number
  other_expense: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function ManagerDashboard() {
  const [data, setData] = useState<PnLRow[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: pnl } = await supabase.from('monthly_pnl').select('*')
      setData(pnl || [])
    } catch (err) {
      console.error('Failed to load manager data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Available years
  const allYears = [...new Set(data.map(r => r.month_key.split('-')[0]))].sort()

  // Filter by year
  const filtered = yearFilter === 'all' ? data : data.filter(r => r.month_key.startsWith(yearFilter + '-'))

  // Group by month
  const allMonths = [...new Set(filtered.map(r => r.month_key))].sort()

  // Per-month totals
  const byMonth = allMonths.map(mk => {
    const rows = filtered.filter(r => r.month_key === mk)
    const income = rows.reduce((s, r) => s + Number(r.rental_income), 0)
    const mgmt = rows.reduce((s, r) => s + Number(r.mgmt_fee_expense), 0)
    const maint = rows.reduce((s, r) => s + Number(r.maintenance_cost), 0)
    const taxes = rows.reduce((s, r) => s + Number(r.tax_expense), 0)
    const insur = rows.reduce((s, r) => s + Number(r.insurance_cost), 0)
    const utils = rows.reduce((s, r) => s + Number(r.utilities_cost), 0)
    const cc = rows.reduce((s, r) => s + Number(r.cc_expense), 0)
    const other = rows.reduce((s, r) => s + Number(r.other_expense), 0)
    const expenses = maint + taxes + insur + utils + cc + other
    const net = income - mgmt - expenses
    return { month: mk, income, mgmt, maint, taxes, insur, utils, cc, other, expenses, net }
  })

  // All-time totals
  const lifetime = byMonth.reduce((acc, m) => ({
    income: acc.income + m.income,
    mgmt: acc.mgmt + m.mgmt,
    expenses: acc.expenses + m.expenses,
    net: acc.net + m.net,
  }), { income: 0, mgmt: 0, expenses: 0, net: 0 })

  if (loading) return <div className="loading-state"><DollarSign /> <p>Loading manager dashboard...</p></div>

  return (
    <div>
      <div className="page-header">
        <h1>Manager Dashboard</h1>
        <p>Cumulative P&L across all properties</p>
      </div>

      {/* Year filter */}
      {allYears.length > 0 && (
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          {allYears.map(y => (
            <button
              key={y}
              onClick={() => setYearFilter(yearFilter === y ? 'all' : y)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                background: yearFilter === y ? 'var(--accent)' : 'transparent',
                color: yearFilter === y ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 12, cursor: 'pointer'
              }}
            >
              {y}
            </button>
          ))}
          {yearFilter !== 'all' && (
            <button
              onClick={() => setYearFilter('all')}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)',
                fontWeight: 600, fontSize: 12, cursor: 'pointer'
              }}
            >
              All Time
            </button>
          )}
        </div>
      )}

      {/* Lifetime summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {yearFilter === 'all' ? 'Total Gross Income (All Time)' : `Gross Income (${yearFilter})`}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>${lifetime.income.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {yearFilter === 'all' ? 'MHG Revenue (All Time)' : `MHG Revenue (${yearFilter})`}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>${lifetime.mgmt.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {yearFilter === 'all' ? 'Total Owner Expenses (All Time)' : `Owner Expenses (${yearFilter})`}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--red)' }}>${lifetime.expenses.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {yearFilter === 'all' ? 'Cumulative Net (All Time)' : `Net (${yearFilter})`}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: lifetime.net >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {lifetime.net >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              ${lifetime.net.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Month-by-Month Table */}
      <div className="card">
        <div className="card-header"><h3>Monthly P&L — All Properties {yearFilter !== 'all' ? `(${yearFilter})` : ''}</h3></div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Income</th>
                <th style={{ textAlign: 'right' }}>Mgmt Fee</th>
                <th style={{ textAlign: 'right' }}>Maint</th>
                <th style={{ textAlign: 'right' }}>Taxes</th>
                <th style={{ textAlign: 'right' }}>Insurance</th>
                <th style={{ textAlign: 'right' }}>Utilities</th>
                <th style={{ textAlign: 'right' }}>CC</th>
                <th style={{ textAlign: 'right' }}>Other</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map(m => {
                const [y, mo] = m.month.split('-')
                return (
                  <tr key={m.month}>
                    <td style={{ fontWeight: 600 }}>{MONTH_NAMES[parseInt(mo) - 1]} {y}</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>${m.income.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>${m.mgmt.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${m.maint.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${m.taxes.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${m.insur.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${m.utils.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${m.cc.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${m.other.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>${m.expenses.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.net >= 0 ? 'var(--green)' : 'var(--red)' }}>${m.net.toLocaleString()}</td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
                <td>TOTAL</td>
                <td style={{ textAlign: 'right', color: 'var(--green)' }}>${lifetime.income.toLocaleString()}</td>
                <td style={{ textAlign: 'right', color: 'var(--accent)' }}>${lifetime.mgmt.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }} colSpan={7}>{lifetime.expenses.toLocaleString()} total expenses</td>
                <td style={{ textAlign: 'right', color: lifetime.net >= 0 ? 'var(--green)' : 'var(--red)' }}>${lifetime.net.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
