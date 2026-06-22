interface StatusBadgeProps {
  status: string
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'
}

const variantMap: Record<string, string> = {
  active: 'badge-green',
  received: 'badge-green',
  completed: 'badge-green',
  pending: 'badge-yellow',
  'in_progress': 'badge-blue',
  late: 'badge-red',
  overdue: 'badge-red',
  expired: 'badge-red',
  cancelled: 'badge-gray',
  vacant: 'badge-yellow',
  maintenance: 'badge-purple',
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const className = variant ? `badge badge-${variant}` : `badge ${variantMap[status] || 'badge-gray'}`
  return (
    <span className={className}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
