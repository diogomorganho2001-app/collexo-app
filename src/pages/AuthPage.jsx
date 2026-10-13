import React, { useState } from 'react';
import { login, resetPassword } from '../services/auth.js';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await login(trimmedEmail, password);
    } catch (e) {
      setError(e?.message || 'Unable to sign in. Please check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email first so we can send the reset link.');
      return;
    }

    setError('');
    setSuccess('');
    try {
      await resetPassword(trimmedEmail);
      setSuccess('Password reset instructions have been sent.');
    } catch (e) {
      setError(e?.message || 'Unable to send a password reset email.');
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-mark">C</div>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to Collexo</h1>
          </div>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <label className="field-group">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="field-group">
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="inline-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-links">
          <button type="button" className="link-button" onClick={handleForgotPassword}>
            Forgot password?
          </button>
          <a href="#register">Create account</a>
        </div>

        {error && <p className="message error-message">{error}</p>}
        {success && <p className="message success-message">{success}</p>}
      </div>
    </div>
  );
}
