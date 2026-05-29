import { BookOpen, Building2, FileText, Users, CreditCard, BarChart3, HelpCircle, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'

const sections = [
  {
    id: 'getting-started',
    icon: BookOpen,
    title: 'Getting Started',
    content: [
      'Log in with the credentials Maggie provides. You\'ll land on the **Overview** dashboard showing key stats.',
      'Explore each section using the sidebar on the left. Everything is organized by function.',
      'If you\'re unsure where to start — the **Tasks** tab shows what\'s assigned to you.',
    ]
  },
  {
    id: 'properties',
    icon: Building2,
    title: 'Properties',
    subsections: [
      {
        title: 'Viewing Properties',
        steps: [
          'Click **Properties** in the sidebar to see the full list.',
          'Each property card shows: address, type, number of units, and status (Active/Inactive).',
          'Click any property to open its detail page with full info.',
        ]
      },
      {
        title: 'Adding a New Property',
        steps: [
          'On the Properties page, click the **+ Add Property** button (top-right).',
          'Fill in: Property Name, Address, Type (residential/commercial), Units, Status.',
          'Click **Save**. The property appears in the list immediately.',
          'Tip: Add the full street address including borough (e.g., "225 E 46th St, Manhattan").',
        ]
      },
      {
        title: 'Editing a Property',
        steps: [
          'Click the property to open its detail page.',
          'Look for the **Edit** button near the property header.',
          'Update any fields and click **Save**.',
        ]
      },
    ]
  },
  {
    id: 'leases',
    icon: FileText,
    title: 'Leases',
    subsections: [
      {
        title: 'Viewing Leases',
        steps: [
          'Open a **Property** detail page.',
          'Scroll to the **Lease** section — it shows the current tenant, rent amount, dates.',
          'Expired or upcoming leases are also listed here.',
        ]
      },
      {
        title: 'Adding a New Lease',
        steps: [
          'Open the property\'s detail page.',
          'In the Lease section, click **+ New Lease**.',
          'Fill in: Tenant name, Start/End dates, Monthly rent, Security deposit.',
          'Click **Save**. The lease is active immediately.',
        ]
      },
      {
        title: 'Editing a Lease',
        steps: [
          'In the Lease section, click **Edit** next to the lease you want to change.',
          'Update fields like rent amount, dates, or deposit.',
          'Click **Save**.',
        ]
      },
      {
        title: 'Renewing a Lease',
        steps: [
          'In the Lease section, click **Renew** next to the current lease.',
          'The form will pre-fill with the current lease info and bump dates forward by one year.',
          'Adjust rent or other terms as needed.',
          'Click **Save** — this creates a new lease record. The old one is kept for history.',
        ]
      },
      {
        title: 'Adding a Tenant to a Lease',
        steps: [
          'When adding or editing a lease, fill in the **Tenant** section.',
          'Enter: First name, Last name, Email, Phone.',
          'The tenant is automatically added to your **Contacts** list.',
        ]
      },
    ]
  },
  {
    id: 'contacts',
    icon: Users,
    title: 'Contacts',
    subsections: [
      {
        title: 'Viewing Contacts',
        steps: [
          'Click **Contacts** in the sidebar.',
          'The directory shows all contacts grouped by role: tenants, vendors, emergency contacts.',
          'Click any contact card to expand and see full details.',
        ]
      },
      {
        title: 'Adding a New Contact',
        steps: [
          'Click the **+ Add Contact** button (top-right of the Contacts page).',
          'Fill in: Name, Phone, Email, Role (tenant/vendor/emergency/other), Notes.',
          'Click **Save**.',
        ]
      },
      {
        title: 'Editing or Deleting a Contact',
        steps: [
          'Click the contact to expand it.',
          'Use **Edit** to update their info, or **Delete** to remove them.',
          'Delete is permanent — only remove duplicates or wrong entries.',
        ]
      },
    ]
  },
  {
    id: 'tasks',
    icon: HelpCircle,
    title: 'Tasks',
    subsections: [
      {
        title: 'Viewing Your Tasks',
        steps: [
          'Click **Tasks** in the sidebar.',
          'Use the quick-filter pills at the top: "My Tasks" shows yours, or filter by person + type.',
          'Sort by Due Date, Priority, or Newest using the dropdown.',
          'The header shows: total open, urgent, and overdue counts.',
        ]
      },
      {
        title: 'Creating a Task',
        steps: [
          'Click the **+ Task** button (top-right of the Tasks page).',
          'Fill in: Title, Due date, Priority (low/medium/high/urgent), Type, Assigned to, Notes.',
          'Click **Save**. The task appears in the assignee\'s view immediately.',
        ]
      },
      {
        title: 'Completing a Task',
        steps: [
          'Mark a task complete by checking the box next to it, or clicking the task to edit and changing its status.',
          'For bulk completion: check multiple task boxes, then click the **Complete** button that appears in the action bar.',
        ]
      },
      {
        title: 'Editing or Deleting a Task',
        steps: [
          'Click a task to open its details and edit any field.',
          'To delete: hover over the task card and click the trash icon. Confirm in the popup.',
        ]
      },
    ]
  },
  {
    id: 'expenses',
    icon: CreditCard,
    title: 'Expenses & Payments',
    subsections: [
      {
        title: 'Logging Rent Received',
        steps: [
          'Open a **Property** detail page.',
          'Scroll to the Lease section and click **Log Rent Payment**.',
          'The form is pre-filled with the current month and full rent amount.',
          'Adjust if it\'s a partial payment (select "Partial" status and enter the reason).',
          'Click **Save**. The payment is recorded in the property\'s history.',
        ]
      },
      {
        title: 'Viewing Payment History',
        steps: [
          'Open a **Property** detail page.',
          'The Payment History card shows all recorded payments for this property.',
          'Use **Edit** to correct a payment amount or status.',
        ]
      },
      {
        title: 'Recording Expenses (Maintenance, Repairs, etc.)',
        steps: [
          'Expenses are tracked per property in the **Financial Reports** section (Admin only).',
          'If you need to log an expense, reach out to Maggie or an admin.',
        ]
      },
    ]
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Reports (Admin Only)',
    subsections: [
      {
        title: 'Running a Financial Report',
        steps: [
          'Click **Reports** in the sidebar (only visible for Admin users).',
          'Select a year and month, or choose "Year to Date" for the current year\'s totals.',
          'The report shows: income (rent), expenses, and net profit/loss per property.',
          'Use the **Export** button to download the data.',
        ]
      },
      {
        title: 'Understanding the Colors',
        steps: [
          'Green = positive net income (profit)',
          'Red = negative net income (loss)',
          'Gray = no data for that period',
        ]
      },
    ]
  },
  {
    id: 'tips',
    icon: Search,
    title: 'Tips & Best Practices',
    content: [
      '**Log rent as soon as it\'s received** — don\'t wait. This keeps the system accurate for reporting.',
      '**Assign tasks to the right person** — use the Assigned To field so everyone knows who\'s responsible.',
      '**Use the Calendar tab** — it shows tasks, lease expirations, and rent due dates all in one place.',
      '**Don\'t delete, edit** — if a contact\'s phone number changes, edit it. If a lease amount was wrong, edit it. Only delete duplicates.',
      '**When in doubt, try clicking** — most items are clickable. Cards expand. Buttons reveal forms. Explore!',
      '**Prefer the dashboard over Agent chat** — the dashboard shows everything at a glance. Use the Agent for quick lookups or to add a task on the go.',
      '**Check Tasks first** — if something needs to be done, it\'s probably already in the task list. Check there before asking Maggie.',
    ]
  },
]

function HelpSection({ section }: { section: typeof sections[0] }) {
  const [open, setOpen] = useState(false)

  if ('content' in section && Array.isArray(section.content)) {
    return (
      <div className="help-section">
        <button className="help-section-header" onClick={() => setOpen(!open)}>
          <section.icon size={18} />
          <span>{section.title}</span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {open && (
          <div className="help-section-body">
            <ul className="help-list">
              {section.content.map((item, i) => (
                <li key={i} className="help-list-item">{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="help-section">
      <button className="help-section-header" onClick={() => setOpen(!open)}>
        <section.icon size={18} />
        <span>{section.title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="help-section-body">
          {section.subsections!.map((sub, i) => (
            <div key={i} className="help-subsection">
              <h4 className="help-subsection-title">{sub.title}</h4>
              <ol className="help-steps">
                {sub.steps.map((step, j) => (
                  <li key={j} className="help-step">
                    <span className="help-step-num">{j + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function HelpGuide() {
  return (
    <div className="help-guide">
      <div className="help-guide-header">
        <h2>📖 How to Use MaggiePM</h2>
        <p className="help-guide-subtitle">
          Everything you need to manage properties, leases, contacts, and more.
          Click any section to expand.
        </p>
      </div>
      <div className="help-guide-body">
        {sections.map(section => (
          <HelpSection key={section.id} section={section} />
        ))}
      </div>
      <div className="help-guide-footer">
        <p>
          Still stuck? Send a message to the MaggiePM Agent in this Telegram chat
          — try "How do I add a new lease?" or "Show me my tasks."
        </p>
      </div>
    </div>
  )
}
