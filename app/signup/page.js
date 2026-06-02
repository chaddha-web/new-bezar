"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const sponsorId = searchParams.get('ref') || ''; // Handle referral invite links

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, sponsorId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Account created. Check your email to verify your account.');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during account creation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-card">
      <div className="signup-header">
        <h1 className="logo-text">BEZAR</h1>
        <p className="signup-subtitle">Create OTT Account</p>
      </div>

      <form onSubmit={handleSignup} className="signup-form">
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {sponsorId && (
          <div className="referral-banner">
            Linked Sponsor Invite: <strong>{sponsorId.substring(0, 8)}...</strong>
          </div>
        )}

        <div className="input-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="input-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@domain.com"
          />
        </div>

        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit" className="signup-btn" disabled={loading || success}>
          {loading ? 'Creating account...' : success ? 'Check your email' : 'Sign Up'}
        </button>
      </form>

      <div className="login-link">
        Already have an account? <Link href="/login">Sign In</Link>
      </div>
    </div>
  );
}



export default function UserSignup() {
  return (
    <main className="user-signup-layout">
      <Suspense fallback={<div className="affiliate-loading">Connecting to Secure Gateway...</div>}>
        <SignupForm />
      </Suspense>

      <style jsx global>{`
        .user-signup-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #111115 0%, #070709 100%);
          font-family: 'Inter', -apple-system, sans-serif;
          color: #fff;
          padding: 20px;
        }

        .signup-card {
          width: 100%;
          max-width: 420px;
          background: rgba(20, 20, 25, 0.6);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        .signup-header {
          text-align: center;
          margin-bottom: 35px;
        }

        .logo-text {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: 6px;
          background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .signup-subtitle {
          color: #a1a1aa;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-top: 8px;
        }

        .signup-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
        }

        .success-banner {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #4ade80;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
        }

        .referral-banner {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.25);
          color: #a855f7;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          text-align: center;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #a1a1aa;
        }

        .input-group input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 14px;
          color: #fff;
          font-size: 15px;
          transition: all 0.2s;
        }

        .input-group input:focus {
          outline: none;
          border-color: #fff;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
        }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 5px;
        }

        .checkbox-group label {
          font-size: 13px;
          color: #a1a1aa;
          cursor: pointer;
        }

        .signup-btn {
          margin-top: 10px;
          background: #fff;
          color: #000;
          border: none;
          border-radius: 10px;
          padding: 16px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.5px;
        }

        .signup-btn:hover {
          background: #e4e4e7;
          transform: translateY(-2px);
        }

        .signup-btn:disabled {
          background: #52525b;
          color: #a1a1aa;
          cursor: not-allowed;
          transform: none;
        }

        .login-link {
          margin-top: 25px;
          text-align: center;
          font-size: 14px;
          color: #a1a1aa;
        }

        .login-link a {
          color: #fff;
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .signup-card { padding: 28px 22px; }
          .logo-text { font-size: 30px; letter-spacing: 4px; }
        }

        .affiliate-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a1a1aa;
          font-size: 15px;
          letter-spacing: 1px;
        }
      `}</style>
    </main>
  );
}
