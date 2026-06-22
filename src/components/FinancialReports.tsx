import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { PaymentForm } from './PaymentForm'
import { DollarSign, TrendingUp, TrendingDown, Plus, FileText, ShieldAlert, Building2, CheckCircle } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

interface Property {
  id: string
  address: string
  unit_number: string | null
  monthly_management_fee: number | null
}

interface LeaseInfo {
  id: string
  property_id: string
  tenant_id: string | null
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
  { value: 'common_charges', label: 'Building Fees (Common Charges)' },
  { value: 'mgmt_fee', label: 'MHG Management Fee' },
  { value: 'maintenance', label: 'Maintenance & Repairs' },
  { value: 'taxes', label: 'Real Estate Taxes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'utilities', label: 'Utilities / Electric' },
  { value: 'other', label: 'Other' },
]

const currentMonth = new Date().toISOString().slice(0, 7)
const currentYear = new Date().getFullYear().toString()

export function FinancialReports() {
  const { profile } = useAuth()

  if (profile && profile.role !== 'admin') {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <ShieldAlert size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, marginBottom: 8 }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Financial reports are only available to admin users.</p>
        </div>
      </div>
    )
  }

  const [viewMode, setViewMode] = useState<'owner' | 'internal'>('owner')
  const [properties, setProperties] = useState<Property[]>([])
  const [leases, setLeases] = useState<LeaseInfo[]>([])
  const [pnlData, setPnlData] = useState<PnLRow[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth)
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentLeaseContext, setPaymentLeaseContext] = useState<{propertyId: string, leaseId: string, tenantId: string | null, rent: number} | null>(null)
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
        supabase.from('leases').select('id, property_id, tenant_id, monthly_rent').eq('status', 'active'),
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
  // Available years from data
  const availableYears = [...new Set(pnlData.map(r => r.month_key.slice(0, 4)))].sort()

  // Months in the selected year
  const monthsInYear = pnlData
    .filter(r => r.month_key.startsWith(selectedYear))
    .map(r => r.month_key)
  const uniqueMonthsInYear = [...new Set(monthsInYear)].sort()

  // Filter data
  const isYtd = selectedMonth === '__ytd__'
  const currentMonthNum = new Date().getMonth() + 1  // 1-based (Jan=1, May=5)
  const filtered = pnlData.filter(r => {
    if (selectedProperty !== 'all' && r.property_id !== selectedProperty) return false
    if (isYtd) {
      if (!r.month_key.startsWith(selectedYear)) return false
      const monthNum = parseInt(r.month_key.split('-')[1], 10)
      if (monthNum > currentMonthNum) return false  // YTD: only up to current month
    } else if (selectedMonth !== 'all') {
      if (r.month_key !== selectedMonth) return false
    }
    return true
  })

  // Group by property for card layout
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

  const totalExpenses = totals.mgmt + totals.maintenance + totals.taxes + totals.insurance + totals.utilities + totals.cc + totals.other
  const netIncome = totals.income - totalExpenses
  const ownerExpenses = totals.maintenance + totals.taxes + totals.insurance + totals.utilities + totals.cc + totals.other
  const netToOwner = totals.income - totals.mgmt - ownerExpenses
  const isOwner = viewMode === 'owner'

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = {
        property_id: expenseForm.property_id,
        category: expenseForm.category,
        description: expenseForm.description || expenseForm.category.replace(/_/g, ' '),
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.expense_date,
        vendor: expenseForm.paid_to || null,
        notes: expenseForm.notes || null,
      }
      const { error } = await supabase.from('expenses').insert(payload)
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
    const period = selectedMonth !== 'all' ? selectedMonth : 'All Months'
    let html = ''

    if (isOwner) {
      // --- Owner Statement PDF ---
      const title = selectedProperty !== 'all'
        ? `MH Group — Property Statement | ${properties.find(p => p.id === selectedProperty)?.address} ${properties.find(p => p.id === selectedProperty)?.unit_number || ''} | ${period}`
        : `MH Group — Property Statement | All Properties | ${period}`
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
          <td style="padding:6px 10px;border-bottom:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold;color:${net >= 0 ? '#7a9a5a' : '#c0392b'}">$${net.toLocaleString()}</td>
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
        <td style="padding:8px 10px;border-bottom:2px solid #333;font-size:13px;text-align:right;color:${netToOwner >= 0 ? '#7a9a5a' : '#c0392b'}">$${netToOwner.toLocaleString()}</td>
      </tr>`

      html = `<!DOCTYPE html>
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

    } else {
      // --- Internal P&L PDF ---
      const title = selectedProperty !== 'all'
        ? `MH Group — Internal P&L | ${properties.find(p => p.id === selectedProperty)?.address} ${properties.find(p => p.id === selectedProperty)?.unit_number || ''} | ${period}`
        : `MH Group — Internal P&L | ${period}`
      const subtitle = 'CONFIDENTIAL — Internal Use Only'

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

      html = `<!DOCTYPE html>
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
    <div class="summary-box"><div class="label">MHG Revenue</div><div class="value" style="color:#7a9a5a">$${totals.mgmt.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">Owner Expenses</div><div class="value" style="color:#b8975a">$${ownerExpenses.toLocaleString()}</div></div>
    <div class="summary-box"><div class="label">Owner Net</div><div class="value" style="color:${netToOwner >= 0 ? '#1a1a1a' : '#c0392b'}">$${netToOwner.toLocaleString()}</div></div>
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
  <div class="footer">MH Group — Internal Document. Not for distribution.</div>
</body></html>`
    }

    const win = window.open('', '_blank')
    if (!win) { alert('Please allow pop-ups for PDF export'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  // Helpers for card
  function calcTotalExpense(r: PnLRow) {
    return Number(r.maintenance_cost) + Number(r.tax_expense) + Number(r.insurance_cost) + Number(r.utilities_cost) + Number(r.cc_expense) + Number(r.other_expense)
  }

  function calcNetRow(r: PnLRow) {
    return Number(r.rental_income) - Number(r.mgmt_fee_expense) - calcTotalExpense(r)
  }

  function calcMgmtFee(r: PnLRow) {
    return Number(r.mgmt_fee_expense)
  }

  function expenseEntries(r: PnLRow) {
    const entries: { label: string; amount: number; isMgmt: boolean }[] = []
    if (isOwner) {
      // Owner view: mgmt fee first, then other expenses
      const mgmt = calcMgmtFee(r)
      if (mgmt > 0) entries.push({ label: 'MHG Management Fee', amount: mgmt, isMgmt: true })
    }
    const cats: [string, string][] = [
      ['maintenance_cost', 'Maintenance'],
      ['tax_expense', 'Real Estate Tax'],
      ['insurance_cost', 'Insurance'],
      ['utilities_cost', 'Utilities'],
      ['cc_expense', 'Common Charges'],
      ['other_expense', 'Other'],
    ]
    for (const [key, label] of cats) {
      const amt = Number((r as any)[key])
      if (amt > 0) entries.push({ label, amount: amt, isMgmt: false })
    }
    return entries
  }
  if (loading) return <div className="loading-state"><DollarSign /> <p>Loading financial reports...</p></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Financial Reports</h1>
          <p>{isOwner ? 'Owner view — statement for property owners' : 'Internal view — MHG revenue and P&L'}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden'
          }}>
            <button
              onClick={() => setViewMode('owner')}
              style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: isOwner ? 'var(--accent)' : 'transparent',
                color: isOwner ? '#fff' : 'var(--text-secondary)',
              }}
            >Owner View</button>
            <button
              onClick={() => setViewMode('internal')}
              style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: !isOwner ? 'var(--accent)' : 'transparent',
                color: !isOwner ? '#fff' : 'var(--text-secondary)',
              }}
            >Internal View</button>
          </div>
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

      {/* Filters — Year + Month drill-down */}
      <div className="filter-bar">
        <select style={fieldStyle} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
          <option value="all">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.address} {p.unit_number || ''}</option>
          ))}
        </select>
        <select style={{ ...fieldStyle, maxWidth: 100 }} value={selectedYear} onChange={e => {
          setSelectedYear(e.target.value)
          setSelectedMonth(currentMonth)
        }}>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select style={{ ...fieldStyle, maxWidth: 150 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          <option value="all">All Months</option>
          <option value="__ytd__">YTD (Year to Date)</option>
          {uniqueMonthsInYear.map(m => {
            const [y, mo] = m.split('-')
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            return (
              <option key={m} value={m}>{monthNames[parseInt(mo) - 1]} {y}</option>
            )
          })}
        </select>
      </div>

      {/* Quick Log Panel */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Quick Log</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select 
              style={{ ...fieldStyle, width: 200 }}
              value={paymentLeaseContext?.propertyId || ''}
              onChange={e => {
                const propId = e.target.value
                // Find active lease for this property
                const l = leases.find((l: any) => l.property_id === propId)
                setPaymentLeaseContext(propId ? {
                  propertyId: propId,
                  leaseId: l?.id || '',
                  tenantId: l?.tenant_id || null,
                  rent: Number(l?.monthly_rent || 0)
                } : null)
              }}
            >
              <option value="">Select property...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.address} {p.unit_number || ''}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: 12 }}
              disabled={!paymentLeaseContext?.propertyId}
              onClick={() => setShowPaymentForm(true)}
            >
              <CheckCircle size={14} /> Log Rent Income
            </button>
            <button
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--red)',
                background: 'transparent', color: 'var(--red)', fontWeight: 600,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                opacity: paymentLeaseContext?.propertyId ? 1 : 0.4, pointerEvents: paymentLeaseContext?.propertyId ? 'auto' : 'none'
              }}
              onClick={() => {
                if (paymentLeaseContext?.propertyId) {
                  setExpenseForm(f => ({ ...f, property_id: paymentLeaseContext.propertyId! }))
                  setShowExpenseForm(true)
                }
              }}
            >
              <Plus size={14} /> Log Expense
            </button>
          </div>
        </div>
      </div>
      {isOwner ? (
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
      ) : (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Gross Rental Income</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>${totals.income.toLocaleString()}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>MHG Revenue</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>${totals.mgmt.toLocaleString()}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Owner Expenses Paid</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>${ownerExpenses.toLocaleString()}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Owner Net</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: netToOwner >= 0 ? 'var(--text-primary)' : 'var(--red)' }}>
                ${netToOwner.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Month-by-Month Breakdown */}
      {selectedProperty !== 'all' ? (
        /* Single property: detailed month rows */
        <>
          {Object.entries(groupedByProperty).length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
              No data for current filters
            </div>
          ) : (
            Object.entries(groupedByProperty).map(([propId, rows]) => {
              const firstRow = rows[0]
              const propOwnerExpenses = rows.reduce((acc, r) => acc + calcTotalExpense(r), 0)
              const propMgmtFee = rows.reduce((acc, r) => acc + Number(r.mgmt_fee_expense), 0)
              const propIncome = rows.reduce((acc, r) => acc + Number(r.rental_income), 0)
              const propNet = propIncome - propMgmtFee - propOwnerExpenses

              return (
                <div key={propId} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Building2 size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {firstRow.address}{firstRow.unit_number ? ` ${firstRow.unit_number}` : ''}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {rows.length} month{rows.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Income</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>${propIncome.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Net</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: propNet >= 0 ? 'var(--green)' : 'var(--red)' }}>${propNet.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Month rows with breakdown */}
                  <div style={{ padding: '8px 16px 16px' }}>
                    {rows.map((r) => {
                      const mgmt = calcMgmtFee(r)
                      const opexp = calcTotalExpense(r)
                      const net = calcNetRow(r)
                      const items = expenseEntries(r)

                      return (
                        <div key={r.month_key} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                                {r.month_key}
                              </div>

                              {/* Owner Statement layout */}
                              {isOwner ? (
                                <div style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Gross Rental Income</span>
                                    <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>${Number(r.rental_income).toLocaleString()}</span>
                                  </div>
                                  
                                  <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                                    {items.map(it => (
                                      <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: it.isMgmt ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: it.isMgmt ? 600 : 400 }}>
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
                              ) : (
                                /* Internal view — flat list */
                                <div>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>
                                    ${Number(r.rental_income).toLocaleString()}
                                  </div>
                                  {items.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No expenses</div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {items.map(it => (
                                        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                          <div style={{ width: 140, color: 'var(--text-muted)', flexShrink: 0 }}>{it.label}</div>
                                          <div style={{ color: 'var(--text-secondary)' }}>${it.amount.toLocaleString()}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(items.length > 0 || mgmt > 0) && (
                                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                                      Total Expenses: ${(mgmt + opexp).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Right: net */}
                            <div style={{ textAlign: 'right', marginLeft: 24 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                                {isOwner ? 'Net to Owner' : 'Net'}
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
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
          )}
        </>
      ) : (
        /* All Properties: simple per-property summary table */
        <div className="card">
          <div className="card-header"><h3>All Properties — {isYtd ? 'Year to Date' : selectedMonth === 'all' ? 'All Months' : new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3></div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            {Object.entries(groupedByProperty).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No data for current filters</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th style={{ textAlign: 'right' }}>Income</th>
                    <th style={{ textAlign: 'right' }}>{isOwner ? 'Mgmt Fee' : 'MHG Fee'}</th>
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    <th style={{ textAlign: 'right' }}>{isOwner ? 'Net to Owner' : 'Net'}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedByProperty).map(([propId, rows]) => {
                    const propIncome = rows.reduce((acc, r) => acc + Number(r.rental_income), 0)
                    const propMgmt = rows.reduce((acc, r) => acc + calcMgmtFee(r), 0)
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
                  {/* Totals row */}
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
                    <td>TOTAL</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>${totals.income.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>${totals.mgmt.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>${(isOwner ? ownerExpenses : totals.mgmt + ownerExpenses).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: netToOwner >= 0 ? 'var(--green)' : 'var(--red)' }}>${netToOwner.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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

      {/* Quick Log Payment Modal */}
      <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Log Rent Income" width="480px">
        {paymentLeaseContext && paymentLeaseContext.leaseId ? (
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
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No active lease for this property. Create a lease first.
          </div>
        )}
      </Modal>
    </div>
  )
}
