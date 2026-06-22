import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { PaymentForm } from './PaymentForm'
import { DollarSign, TrendingUp, TrendingDown, FileText, Building2, ChevronLeft, ChevronRight, Plus, CheckCircle } from 'lucide-react'

interface Property {
  id: string
  address: string
  unit_number: string | null
}

interface PnLRow {
  property_id: string
  address: string
  unit_number: string | null
  month_key: string
  month_date: string
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

export function FinancialReports() {
  const [properties, setProperties] = useState<Property[]>([])
  const [pnlData, setPnlData] = useState<PnLRow[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [monthRangeMode, setMonthRangeMode] = useState(false)
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [paymentLeaseContext, setPaymentLeaseContext] = useState<{leaseId: string, tenantId: string | null, rent: number} | null>(null)
  const [expenseForm, setExpenseForm] = useState({ category: 'common_charges', amount: '', date: new Date().toISOString().split('T')[0], description: '', vendor: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [propsRes, pnlRes] = await Promise.all([
        supabase.from('properties').select('id, address, unit_number').order('address'),
        supabase.from('monthly_pnl').select('*'),
      ])
      setProperties(propsRes.data || [])
      setPnlData(pnlRes.data || [])
    } catch (err) {
      console.error('Failed to load financial data:', err)
    } finally {
      setLoading(false)
    }
  }

  // All unique month_keys from data sorted
  const allMonths = [...new Set(pnlData.map(r => r.month_key))].sort()
  const monthIndex = allMonths.indexOf(selectedMonth)

  function navMonth(dir: 'prev' | 'next') {
    const idx = monthIndex + (dir === 'prev' ? -1 : 1)
    if (idx >= 0 && idx < allMonths.length) setSelectedMonth(allMonths[idx])
  }

  // Filter data
  const filtered = pnlData.filter(r => {
    if (selectedProperty !== 'all' && r.property_id !== selectedProperty) return false
    if (monthRangeMode) {
      if (rangeStart && r.month_key < rangeStart) return false
      if (rangeEnd && r.month_key > rangeEnd) return false
      return true
    }
    if (r.month_key !== selectedMonth) return false
    return true
  })

  // Group by property
  const groupedByProperty = filtered.reduce<Record<string, PnLRow[]>>((acc, r) => {
    if (!acc[r.property_id]) acc[r.property_id] = []
    acc[r.property_id].push(r)
    return acc
  }, {})

  // Calculate totals
  const totals = filtered.reduce((acc, r) => ({
    income: acc.income + Number(r.rental_income),
    mgmt: acc.mgmt + Number(r.mgmt_fee_expense),
    maintenance: acc.maintenance + Number(r.maintenance_cost),
    taxes: acc.taxes + Number(r.tax_expense),
    insurance: acc.insurance + Number(r.insurance_cost),
    utilities: acc.utilities + Number(r.utilities_cost),
    cc: acc.cc + Number(r.cc_expense),
    other: acc.other + Number(r.other_expense),
  }), { income: 0, mgmt: 0, maintenance: 0, taxes: 0, insurance: 0, utilities: 0, cc: 0, other: 0 })

  const ownerExpenses = totals.maintenance + totals.taxes + totals.insurance + totals.utilities + totals.cc + totals.other
  const netToOwner = totals.income - totals.mgmt - ownerExpenses

  // Format month key for display
  function formatMonth(mk: string) {
    const [y, m] = mk.split('-')
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
  }

  // --- PDF export ---
  function exportPdf() {
    const periodLabel = monthRangeMode ? rangeLabel : formatMonth(selectedMonth)
    const title = selectedProperty !== 'all'
      ? `MH Group — Property Statement | ${properties.find(p => p.id === selectedProperty)?.address} ${properties.find(p => p.id === selectedProperty)?.unit_number || ''} | ${periodLabel}`
      : `MH Group — Property Statement | All Properties | ${periodLabel}`
    const subtitle = 'Prepared by: Maggie Huang Group Property Management'

    const rowsHtml = filtered.map(r => {
      const mgmt = Number(r.mgmt_fee_expense)
      const opexp = Number(r.maintenance_cost) + Number(r.tax_expense) + Number(r.insurance_cost) + Number(r.utilities_cost) + Number(r.cc_expense) + Number(r.other_expense)
      const net = Number(r.rental_income) - mgmt - opexp
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px">${r.address} ${r.unit_number || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px">${r.month_key}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.rental_income).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right;color:#b8975a;font-weight:600">$${mgmt.toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.maintenance_cost).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.tax_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.insurance_cost).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.cc_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.utilities_cost).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.other_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold;color:${net >= 0 ? '#7a9a5a' : '#c0392b'}\">$${net.toLocaleString()}</td>
      </tr>`
    }).join('\n')

    const totalsRow = `<tr style="background:#f5f5f5;font-weight:bold">
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px">TOTAL</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px"></td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.income.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right;color:#b8975a;font-weight:600">$${totals.mgmt.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.maintenance.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.taxes.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.insurance.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.cc.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.utilities.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.other.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right;color:${netToOwner >= 0 ? '#7a9a5a' : '#c0392b'}\">$${netToOwner.toLocaleString()}</td>
    </tr>`

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
  h1 { font-size: 20px; margin-bottom: 4px; color: #b8975a; }
  .subtitle { font-size: 12px; color: #6b6560; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9c958e; border-bottom: 2px solid #333; font-weight: 600; }
  .summary { display: flex; gap: 16px; margin-bottom: 20px; }
  .summary-box { flex: 1; text-align: center; padding: 12px; background: #fafafa; border: 1px solid #e8e6e1; border-radius: 6px; }
  .summary-box .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9c958e; margin-bottom: 4px; }
  .summary-box .value { font-size: 18px; font-weight: bold; }
  .footer { margin-top: 24px; font-size: 10px; color: #9c958e; text-align: center; }
</style></head><body>
  <h1>${title}</h1>
  <div class="subtitle">${subtitle} | Generated ${new Date().toLocaleDateString()}</div>
  <div class="summary">
    <div class="summary-box"><div class="label">Gross Rental Income</div><div class="value" style="color:#7a9a5a">$${totals.income.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">MHG Management Fee</div><div class="value" style="color:#b8975a">$${totals.mgmt.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">Net to Owner</div><div class="value" style="color:${netToOwner >= 0 ? '#7a9a5a' : '#c0392b'}">$${netToOwner.toLocaleString()}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Property</th><th>Month</th><th style="text-align:right">Gross Rent</th><th style="text-align:right;color:#b8975a">MHG Mgmt Fee</th>
      <th style="text-align:right">Maint</th><th style="text-align:right">Taxes</th><th style="text-align:right">Insur</th>
      <th style="text-align:right">CC</th><th style="text-align:right">Util</th><th style="text-align:right">Other</th>
      <th style="text-align:right">Net to Owner</th>
    </tr></thead>
    <tbody>${rowsHtml}${totalsRow}</tbody>
  </table>
  <div class="footer">Prepared by MH Group Property Management — Confidential</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Please allow pop-ups for PDF export'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  // Helpers
  function calcTotalExpense(r: PnLRow) {
    return Number(r.maintenance_cost) + Number(r.tax_expense) + Number(r.insurance_cost) + Number(r.utilities_cost) + Number(r.cc_expense) + Number(r.other_expense)
  }
  function calcNetRow(r: PnLRow) {
    return Number(r.rental_income) - Number(r.mgmt_fee_expense) - calcTotalExpense(r)
  }
  function expenseEntries(r: PnLRow) {
    const entries: { label: string; amount: number }[] = []
    const cats: [string, string][] = [
      ['mgmt_fee_expense', 'MHG Management Fee'],
      ['maintenance_cost', 'Maintenance'],
      ['tax_expense', 'Real Estate Tax'],
      ['insurance_cost', 'Insurance'],
      ['utilities_cost', 'Utilities'],
      ['cc_expense', 'Common Charges'],
      ['other_expense', 'Other'],
    ]
    for (const [key, label] of cats) {
      const amt = Number((r as any)[key])
      if (amt > 0) entries.push({ label, amount: amt })
    }
    return entries
  }

  if (loading) return <div className="loading-state"><DollarSign /> <p>Loading financial reports...</p></div>

  const monthLabel = allMonths.includes(selectedMonth) ? formatMonth(selectedMonth) : selectedMonth
  const rangeLabel = monthRangeMode
    ? `${formatMonth(rangeStart || allMonths[0] || '')} — ${formatMonth(rangeEnd || allMonths[allMonths.length - 1] || '')}`
    : monthLabel

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Financial Reports</h1>
          <p>Owner statements for property owners</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={exportPdf} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600,
            fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FileText size={16} /> Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-primary)',
          color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          boxSizing: 'border-box'
        }} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
          <option value="all">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.address} {p.unit_number || ''}</option>
          ))}
        </select>

        {/* Period toggle + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!monthRangeMode ? (
            /* Single month nav */
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => navMonth('prev')} disabled={monthIndex <= 0} style={{
                padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: monthIndex <= 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: monthIndex <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center'
              }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 600, fontSize: 14, minWidth: 90, textAlign: 'center' }}>
                {monthLabel}
              </span>
              <button onClick={() => navMonth('next')} disabled={monthIndex >= allMonths.length - 1} style={{
                padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: monthIndex >= allMonths.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: monthIndex >= allMonths.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center'
              }}>
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            /* Range selectors */
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select value={rangeStart || allMonths[0] || ''} onChange={e => setRangeStart(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
                {allMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
              <select value={rangeEnd || allMonths[allMonths.length - 1] || ''} onChange={e => setRangeEnd(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
                {allMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => {
            if (monthRangeMode) {
              setMonthRangeMode(false)
              setRangeStart('')
              setRangeEnd('')
            } else {
              setMonthRangeMode(true)
              setRangeStart(allMonths[0] || selectedMonth)
              setRangeEnd(selectedMonth)
            }
          }} style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
            background: monthRangeMode ? 'var(--accent)' : 'transparent',
            color: monthRangeMode ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            {monthRangeMode ? 'Single Month' : 'YTD / Range'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Gross Rental Income</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>${totals.income.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>MHG Management Fee</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>${totals.mgmt.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Expenses</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--red)' }}>${ownerExpenses.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Net to Owner</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: netToOwner >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {netToOwner >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              ${netToOwner.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Log — only when a single property is selected */}
      {selectedProperty !== 'all' && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Quick Log</span>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: 12 }}
              onClick={async () => {
                // Fetch active lease for this property
                const { data: leases } = await supabase
                  .from('leases').select('id, tenant_id, monthly_rent')
                  .eq('property_id', selectedProperty).eq('status', 'active').limit(1)
                const l = leases?.[0]
                if (!l) { alert('No active lease for this property'); return }
                setPaymentLeaseContext({ leaseId: l.id, tenantId: l.tenant_id, rent: Number(l.monthly_rent) })
                setShowPaymentForm(true)
              }}
            >
              <CheckCircle size={14} /> Log Rent Income
            </button>
            <button
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--red)',
                background: 'transparent', color: 'var(--red)', fontWeight: 600,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
              onClick={() => setShowExpenseForm(true)}
            >
              <Plus size={14} /> Log Expense
            </button>
          </div>
        </div>
      )}

      {/* Per-Property Breakdown */}
      {selectedProperty !== 'all' ? (
        Object.entries(groupedByProperty).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            No data for {rangeLabel}
          </div>
        ) : (
          Object.entries(groupedByProperty).map(([propId, rows]) => {
            const firstRow = rows[0]
            return (
              <div key={propId} className="card" style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Building2 size={16} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {firstRow.address}{firstRow.unit_number ? ` ${firstRow.unit_number}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '8px 16px 16px' }}>
                  {rows.map(r => {
                    const net = calcNetRow(r)
                    const items = expenseEntries(r)
                    return (
                      <div key={r.month_key} style={{ padding: '12px 0' }}>
                        <div style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Gross Rental Income</span>
                            <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>${Number(r.rental_income).toLocaleString()}</span>
                          </div>
                          <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                            {items.map(it => (
                              <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: it.label === 'MHG Management Fee' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: it.label === 'MHG Management Fee' ? 600 : 400 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                                  {it.label}
                                </span>
                                <span>-${it.amount.toLocaleString()}</span>
                              </div>
                            ))}
                            {items.length === 0 && (
                              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No expenses recorded this month.</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: 12, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Net to Owner</span>
                            <div style={{ fontWeight: 700, color: net >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 16, background: net >= 0 ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)', padding: '3px 10px', borderRadius: 6 }}>
                              ${net.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )
      ) : (
        /* All Properties: summary table */
        <div className="card">
          <div className="card-header"><h3>All Properties — {rangeLabel}</h3></div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            {Object.entries(groupedByProperty).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No data for {rangeLabel}</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th style={{ textAlign: 'right' }}>Income</th>
                    <th style={{ textAlign: 'right' }}>Mgmt Fee</th>
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    <th style={{ textAlign: 'right' }}>Net to Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedByProperty).map(([propId, rows]) => {
                    const propIncome = rows.reduce((acc, r) => acc + Number(r.rental_income), 0)
                    const propMgmt = rows.reduce((acc, r) => acc + Number(r.mgmt_fee_expense), 0)
                    const propExpenses = rows.reduce((acc, r) => acc + calcTotalExpense(r), 0)
                    const propNet = propIncome - propMgmt - propExpenses
                    const firstRow = rows[0]
                    return (
                      <tr key={propId}>
                        <td style={{ fontWeight: 500 }}>{firstRow.address}{firstRow.unit_number ? ` ${firstRow.unit_number}` : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green)' }}>${propIncome.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent)' }}>${propMgmt.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--red)' }}>${propExpenses.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: propNet >= 0 ? 'var(--green)' : 'var(--red)' }}>${propNet.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
                    <td>TOTAL</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>${totals.income.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>${totals.mgmt.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>${ownerExpenses.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: netToOwner >= 0 ? 'var(--green)' : 'var(--red)' }}>${netToOwner.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Log Payment Modal */}
      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Log Rent Income" width="480px">
        {paymentLeaseContext && (
          <PaymentForm
            propertyId={selectedProperty}
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

      {/* Add Expense Modal */}
      <Modal open={showExpenseForm} onClose={() => setShowExpenseForm(false)} title="Add Expense" width="500px">
        <form onSubmit={async (e) => {
          e.preventDefault()
          try {
            await supabase.from('expenses').insert({
              property_id: selectedProperty,
              category: expenseForm.category,
              amount: parseFloat(expenseForm.amount),
              date: expenseForm.date,
              description: expenseForm.description || null,
              vendor: expenseForm.vendor || null,
            })
            setShowExpenseForm(false)
            setExpenseForm({ category: 'common_charges', amount: '', date: new Date().toISOString().split('T')[0], description: '', vendor: '' })
            loadData()
          } catch (err: any) {
            alert('Failed to save expense: ' + err.message)
          }
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category *</label>
              <select required value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="common_charges">Building Fees (Common Charges)</option>
                <option value="mgmt_fee">MHG Management Fee</option>
                <option value="maintenance">Maintenance & Repairs</option>
                <option value="taxes">Real Estate Taxes</option>
                <option value="insurance">Insurance</option>
                <option value="utilities">Utilities / Electric</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount *</label>
              <input type="number" step="0.01" required value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date *</label>
              <input type="date" required value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Vendor</label>
              <input value={expenseForm.vendor} onChange={e => setExpenseForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
              <input value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="filter-btn" onClick={() => setShowExpenseForm(false)}>Cancel</button>
            <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Save Expense</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
