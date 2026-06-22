import React from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  change?: string
  changeType?: 'positive' | 'negative'
}

export function StatCard({ label, value, icon, iconBg, change, changeType }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ background: iconBg }}>
          {icon}
        </div>
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-value">{value}</div>
      {change && (
        <div className={`stat-card-change ${changeType || 'positive'}`}>
          {change}
        </div>
      )}
    </div>
  )
}
