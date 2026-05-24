import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Building2, KeyRound, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error === 'Invalid login credentials' ? 'Invalid email or password' : error)
    }
    setLoading(false)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) {
        setResetError(error.message)
      } else {
        setResetSent(true)
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset link')
    } finally {
      setResetLoading(false)
    }
  }

  // Forgot password view
  if (showForgot) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <Building2 size={28} />
              <span>MH Group</span>
            </div>
            <h1>Reset Password</h1>
            <p>Enter your email to receive a reset link</p>
          </div>

          {resetSent ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle size={48} style={{ color: 'var(--green)', marginBottom: 16 }} />
              <p>Check your email for a password reset link.</p>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowForgot(false); setResetSent(false); setResetEmail('') }}
                style={{ marginTop: 16 }}
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="login-form">
              {resetError && (
                <div className="login-error">{resetError}</div>
              )}

              <div className="login-field">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary login-btn" disabled={resetLoading}>
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setShowForgot(false); setResetError('') }}
                style={{ marginTop: 8, width: '100%' }}
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Building2 size={28} />
            <span>MH Group</span>
          </div>
          <h1>Property Management</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="login-field">
            <Mail size={16} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <KeyRound size={16} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowForgot(true)}
              style={{ fontSize: 13, padding: '4px 0' }}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
