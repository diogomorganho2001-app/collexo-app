import React, { useState } from 'react';
import { login, register } from '../services/auth.js';

export default function AuthPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  async function handleLogin() {
    setError('');
    try {
      await login(email, password);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRegister() {
    setError('');
    try {
      await register(email, password);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div id="authPage">
      <div className="auth-inner">
        <div className="auth-logo">
          <span className="trophy-big">📇</span>
          <h1>Collexo</h1>
          <p>Collect-Connect-Complete</p>
        </div>
        <div className="auth-box">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>
          )}
          <button className="btn-gold" onClick={handleLogin}>Sign In</button>
          <button className="btn-ghost" onClick={handleRegister}>Create Account</button>
        </div>
      </div>
    </div>
  );
}
