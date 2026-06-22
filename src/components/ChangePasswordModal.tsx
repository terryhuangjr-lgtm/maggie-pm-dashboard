import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { KeyRound, CheckCircle } from 'lucide-react'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setNewPassword('')
          setConfirmPassword('')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Change Password" width="400px">
      {success ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <CheckCircle size={48} style={{ color: 'var(--green)', marginBottom: 16 }} />
          <p>Password updated successfully!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div className="login-error">{error}</div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              New Password
            </label>
            <div className="login-field">
              <KeyRound size={16} />
              <input
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Confirm Password
            </label>
            <div className="login-field">
              <KeyRound size={16} />
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
