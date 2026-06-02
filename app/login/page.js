"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';



export default function UserLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Signed in. Redirecting…');
        router.push('/');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="user-login-layout">
      <div className="login-card">
        <div className="login-header">
          <h1 className="logo-text">BEZAR</h1>
          <p className="login-subtitle">Cinematic OTT Login</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading || success}>
            {loading ? 'Signing in...' : success ? 'Success!' : 'Sign In'}
          </button>
        </form>

        <div className="signup-link">
          New to Bezar? <Link href="/signup">Create an Account</Link>
        </div>
      </div>

      <style jsx global>{`
        .user-login-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #111115 0%, #070709 100%);
          font-family: 'Inter', -apple-system, sans-serif;
          color: #fff;
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: rgba(20, 20, 25, 0.6);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        .login-header {
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

        .login-subtitle {
          color: #a1a1aa;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-top: 8px;
        }

        .login-form {
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

        .login-btn {
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

        .login-btn:hover {
          background: #e4e4e7;
          transform: translateY(-2px);
        }

        .login-btn:disabled {
          background: #52525b;
          color: #a1a1aa;
          cursor: not-allowed;
          transform: none;
        }

        .signup-link {
          margin-top: 25px;
          text-align: center;
          font-size: 14px;
          color: #a1a1aa;
        }

        .signup-link a {
          color: #fff;
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .login-card { padding: 28px 22px; }
          .logo-text { font-size: 30px; letter-spacing: 4px; }
        }
      `}</style>
    </main>
  );
}
