import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { DollarSign, TrendingUp, TrendingDown, Plus, FileText } from 'lucide-react'

interface Property {
  id: string
  address: string
  unit_number: string | null
  monthly_management_fee: number | null
}

interface LeaseInfo {
  property_id: string
  monthly_rent: number
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

const CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance & Repairs' },
  { value: 'taxes', label: 'Real Estate Taxes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'common_charges', label: 'Common Charges' },
  { value: 'other', label: 'Other' },
]

export function FinancialReports() {
  const [properties, setProperties] = useState<Property[]>([])
  const [, setLeases] = useState<LeaseInfo[]>([])
  const [pnlData, setPnlData] = useState<PnLRow[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    property_id: '', category: 'maintenance', description: '',
    amount: '', expense_date: new Date().toISOString().split('T')[0],
    paid_to: '', notes: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [propsRes, leasesRes, pnlRes] = await Promise.all([
        supabase.from('properties').select('id, address, unit_number, monthly_management_fee').order('address'),
        supabase.from('leases').select('property_id, monthly_rent').eq('status', 'active'),
        supabase.from('monthly_pnl').select('*'),
      ])
      setProperties(propsRes.data || [])
      setLeases(leasesRes.data || [])
      setPnlData(pnlRes.data || [])
    } catch (err) {
      console.error('Failed to load financial data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get unique months from data
  const availableMonths = [...new Set(pnlData.map(r => r.month_key))].sort()

  // Filter data
  const filtered = pnlData.filter(r => {
    if (selectedProperty !== 'all' && r.property_id !== selectedProperty) return false
    if (selectedMonth !== 'all' && r.month_key !== selectedMonth) return false
    return true
  })

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

  const totalExpenses = totals.mgmt + totals.maintenance + totals.taxes + totals.insurance + totals.utilities + totals.cc + totals.other
  const netIncome = totals.income - totalExpenses

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = {
        property_id: expenseForm.property_id,
        category: expenseForm.category,
        description: expenseForm.description || expenseForm.category.replace(/_/g, ' '),
        amount: parseFloat(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        paid_to: expenseForm.paid_to || null,
        notes: expenseForm.notes || null,
      }
      const { error } = await supabase.from('property_expenses').insert(payload)
      if (error) throw error
      setShowExpenseForm(false)
      setExpenseForm({
        property_id: '', category: 'maintenance', description: '',
        amount: '', expense_date: new Date().toISOString().split('T')[0],
        paid_to: '', notes: ''
      })
      await loadData()
    } catch (err: any) {
      alert('Failed to save expense: ' + err.message)
    }
  }

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

  function exportPdf() {
    const title = selectedProperty !== 'all'
      ? `P&L — ${properties.find(p => p.id === selectedProperty)?.address} ${properties.find(p => p.id === selectedProperty)?.unit_number || ''}`
      : 'P&L — All Properties'
    const subtitle = selectedMonth !== 'all' ? `Month: ${selectedMonth}` : 'All Months'
    const filterLabel = selectedProperty !== 'all' || selectedMonth !== 'all'
      ? `Filtered: ${title}${selectedMonth !== 'all' ? ` — ${selectedMonth}` : ''}`
      : ''

    // Build a printable HTML document
    const rowsHtml = filtered.map(r => {
      const exp = Number(r.mgmt_fee_expense) + Number(r.maintenance_cost) + Number(r.tax_expense) + Number(r.insurance_cost) + Number(r.utilities_cost) + Number(r.cc_expense) + Number(r.other_expense)
      const net = Number(r.rental_income) - exp
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px">${r.address} ${r.unit_number || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px">${r.month_key}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.rental_income).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.mgmt_fee_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.maintenance_cost).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.tax_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.insurance_cost).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.utilities_cost).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.cc_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">$${Number(r.other_expense).toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold">$${exp.toLocaleString()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold;color:${net >= 0 ? '#7a9a5a' : '#c0392b'}">$${net.toLocaleString()}</td>
      </tr>`
    }).join('\n')

    const totalsRow = `<tr style="background:#f5f5f5;font-weight:bold">
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px">TOTAL</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px"></td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.income.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.mgmt.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.maintenance.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.taxes.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.insurance.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.utilities.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.cc.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totals.other.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right">$${totalExpenses.toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right;color:${netIncome >= 0 ? '#7a9a5a' : '#c0392b'}">$${netIncome.toLocaleString()}</td>
    </tr>`

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #b8975a; }
  .subtitle { font-size: 13px; color: #6b6560; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9c958e; border-bottom: 2px solid #333; font-weight: 600; }
  .summary { display: flex; gap: 16px; margin-bottom: 20px; }
  .summary-box { flex: 1; text-align: center; padding: 12px; background: #fafafa; border: 1px solid #e8e6e1; border-radius: 6px; }
  .summary-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9c958e; margin-bottom: 4px; }
  .summary-box .value { font-size: 20px; font-weight: bold; }
  .footer { margin-top: 24px; font-size: 10px; color: #9c958e; text-align: center; }
</style></head><body>
  <h1>MH Group — ${title}</h1>
  <div class="subtitle">${subtitle}${filterLabel ? '<br>' + filterLabel : ''} | Generated ${new Date().toLocaleDateString()}</div>
  <div class="summary">
    <div class="summary-box"><div class="label">Total Income</div><div class="value" style="color:#7a9a5a">$${totals.income.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">Total Expenses</div><div class="value" style="color:#c0392b">$${totalExpenses.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">Net Income</div><div class="value" style="color:${netIncome >= 0 ? '#7a9a5a' : '#c0392b'}">$${netIncome.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">Margin</div><div class="value">${totals.income > 0 ? Math.round((netIncome / totals.income) * 100) + '%' : '—'}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Property</th><th>Month</th><th style="text-align:right">Income</th><th style="text-align:right">Mgmt Fee</th>
      <th style="text-align:right">Maint</th><th style="text-align:right">Taxes</th><th style="text-align:right">Insur</th>
      <th style="text-align:right">Util</th><th style="text-align:right">CC</th><th style="text-align:right">Other</th>
      <th style="text-align:right">Exp Total</th><th style="text-align:right">Net</th>
    </tr></thead>
    <tbody>${rowsHtml}${totalsRow}</tbody>
  </table>
  <div class="footer">MH Group — Property Management | Confidential</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Please allow pop-ups for PDF export'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  if (loading) return <div className="loading-state"><DollarSign /> <p>Loading financial reports...</p></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Financial Reports</h1>
          <p>Monthly P&L by property</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportPdf} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600,
            fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FileText size={16} /> Export PDF
          </button>
          <button onClick={() => setShowExpenseForm(true)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 600,
            fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select style={fieldStyle} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
          <option value="all">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.address} {p.unit_number || ''}</option>
          ))}
        </select>
        <select style={{ ...fieldStyle, maxWidth: 150 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          <option value="all">All Months</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Income</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>${totals.income.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Expenses</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--red)' }}>${totalExpenses.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Net Income</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: netIncome >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {netIncome >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              ${netIncome.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Margin</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: netIncome >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totals.income > 0 ? `${Math.round((netIncome / totals.income) * 100)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* P&L Table */}
      <div className="card">
        <div className="card-header"><h3>Profit & Loss</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Income</th>
                <th style={{ textAlign: 'right' }}>Mgmt Fee</th>
                <th style={{ textAlign: 'right' }}>Maintenance</th>
                <th style={{ textAlign: 'right' }}>Taxes</th>
                <th style={{ textAlign: 'right' }}>Insurance</th>
                <th style={{ textAlign: 'right' }}>Utilities</th>
                <th style={{ textAlign: 'right' }}>CC</th>
                <th style={{ textAlign: 'right' }}>Other</th>
                <th style={{ textAlign: 'right' }}>Total Exp</th>
                <th style={{ textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No data for current filters</td></tr>
              ) : (
                filtered.map((r, i) => {
                  const exp = Number(r.mgmt_fee_expense) + Number(r.maintenance_cost) + Number(r.tax_expense) + Number(r.insurance_cost) + Number(r.utilities_cost) + Number(r.cc_expense) + Number(r.other_expense)
                  const net = Number(r.rental_income) - exp
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.address}{r.unit_number ? ` ${r.unit_number}` : ''}</td>
                      <td>{r.month_key}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>${Number(r.rental_income).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.mgmt_fee_expense).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.maintenance_cost).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.tax_expense).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.insurance_cost).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.utilities_cost).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.cc_expense).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>${Number(r.other_expense).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${exp.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>${net.toLocaleString()}</td>
                    </tr>
                  )
                })
              )}
              {/* Totals row */}
              {filtered.length > 1 && (
                <tr style={{ background: 'var(--accent-light)' }}>
                  <td style={{ fontWeight: 700 }}>TOTAL</td>
                  <td>{filtered.length} rows</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>${totals.income.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.mgmt.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.maintenance.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.taxes.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.insurance.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.utilities.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.cc.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${totals.other.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>${totalExpenses.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: netIncome >= 0 ? 'var(--green)' : 'var(--red)' }}>${netIncome.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal open={showExpenseForm} onClose={() => setShowExpenseForm(false)} title="Add Expense" width="500px">
        <form onSubmit={handleAddExpense}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Property *</label>
              <select style={fieldStyle} required value={expenseForm.property_id} onChange={e => setExpenseForm({ ...expenseForm, property_id: e.target.value })}>
                <option value="">Select property...</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.address} {p.unit_number || ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category *</label>
              <select style={fieldStyle} required value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount *</label>
              <input style={fieldStyle} type="number" step="0.01" min="0" required
                value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <input style={fieldStyle} type="date" required value={expenseForm.expense_date}
                onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Paid To</label>
              <input style={fieldStyle} value={expenseForm.paid_to}
                onChange={e => setExpenseForm({ ...expenseForm, paid_to: e.target.value })} placeholder="Vendor name" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input style={fieldStyle} value={expenseForm.description}
                onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="What was this for?" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...fieldStyle, minHeight: 50, resize: 'vertical' }} value={expenseForm.notes}
                onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="filter-btn" onClick={() => setShowExpenseForm(false)}>Cancel</button>
            <button type="submit" style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600,
              fontSize: 13, cursor: 'pointer'
            }}>Save Expense</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
