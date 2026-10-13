import React, { useState } from 'react';
import { register } from '../services/auth.js';

const PASSWORD_MIN_LENGTH = 6;

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError('Please enter your display name.');
      return;
    }

    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the terms and privacy policy to continue.');
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await register(trimmedEmail, password, trimmedName);
      setSuccess('Account created successfully.');
      window.location.hash = '#collection';
    } catch (e) {
      const message = e?.message || 'Unable to create your account right now.';
      if (message.toLowerCase().includes('email')) {
        setError('That email address is already in use or invalid.');
      } else if (message.toLowerCase().includes('password')) {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card compact-card">
        <div className="auth-header">
          <div className="auth-mark accent">C</div>
          <div>
            <p className="eyebrow">Create your account</p>
            <h1>Join Collexo</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field-group">
            <span>Display name / username</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Collector name"
              autoComplete="username"
            />
          </label>

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
                placeholder="At least 6 characters"
                autoComplete="new-password"
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

          <label className="field-group">
            <span>Confirm password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>I agree to the Collexo terms and privacy policy.</span>
          </label>

          <button type="submit" className="primary-button accent-button" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-links">
          <span>Already have an account?</span>
          <a href="#signin">Sign in</a>
        </div>

        {error && <p className="message error-message">{error}</p>}
        {success && <p className="message success-message">{success}</p>}
      </div>
    </div>
  );
}
