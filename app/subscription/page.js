"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';



export default function SubscriptionPricing() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success) setUser(d.user);
      });
  }, []);

  const handleSubscribe = async (planName, price) => {
    if (!user) {
      alert('Please log in first.');
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      // 8% tax/surcharge for INR subscriptions
      const totalInr = Math.round(price * 1.08);
      const astroUrl = process.env.NEXT_PUBLIC_ASTRO_URL || 'http://localhost:3001';
      const url = `${astroUrl}/?bezar_checkout=true&amountInr=${totalInr}&type=subscription&plan=${planName}&userId=${user.id}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`;
      const popup = window.open(url, 'AstroPayment', 'width=500,height=750,left=100,top=100');
      
      const handleMessage = async (event) => {
        if (event.origin !== astroUrl) return;
        if (event.data?.type === 'RAZORPAY_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          
          await fetch('/api/webhooks/astro-success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              paymentId: event.data.paymentId,
              type: 'subscription',
              planName: planName
            })
          });
          
          if (popup) popup.close();
          alert(`Success! You have unlocked the ${planName} Plan. Premium content is now available!`);
          window.location.href = '/';
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error(err);
      alert('Network error captured during checkout process');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="subscription-layout">
      <header className="subscription-header">
        <h1 className="logo-title">BEZAR</h1>
        <p className="subscription-subtitle">Select Streaming Tier</p>
      </header>

      <section className="pricing-cards-row">
        {/* FREE CARD */}
        <div className="pricing-card">
          <div className="card-top">
            <h3>Free Viewer</h3>
            <div className="price-tag">₹0 <span>/ Month</span></div>
          </div>
          <ul className="features-list">
            <li>Access to standard video trailers</li>
            <li>Limited daily news channels</li>
            <li>Standard video resolutions</li>
          </ul>
          <button onClick={() => router.push('/')} className="card-btn secondary-btn">
            Active Tier
          </button>
        </div>

        {/* MONTHLY CARD */}
        <div className="pricing-card highlighted-card">
          <div className="badge-featured">RECOMMENDED</div>
          <div className="card-top">
            <h3>Monthly Plan</h3>
            <div className="price-tag">₹299 <span>/ Month</span></div>
          </div>
          <ul className="features-list">
            <li><strong>Full-screen Cinematic Theater Mode</strong></li>
            <li>Unlimited HLS news live streams</li>
            <li>Access MLM & Network Affiliate earnings</li>
            <li>Yields multipliers up to 0.8% daily</li>
          </ul>
          <button onClick={() => handleSubscribe('Monthly', 299)} disabled={loading} className="card-btn primary-btn">
            {loading ? 'Processing Checkout...' : 'Subscribe Monthly'}
          </button>
        </div>

        {/* YEARLY CARD */}
        <div className="pricing-card">
          <div className="card-top">
            <h3>Yearly Plan</h3>
            <div className="price-tag">₹3,299 <span>/ Year</span></div>
          </div>
          <ul className="features-list">
            <li>4K Cinema video playback channels</li>
            <li>Custom offline HLS stream configs</li>
            <li>Double direct commission referral tiers</li>
            <li>Accelerated 2.5x caps payouts</li>
          </ul>
          <button onClick={() => handleSubscribe('Yearly', 3299)} disabled={loading} className="card-btn secondary-btn">
            {loading ? 'Processing Checkout...' : 'Subscribe Yearly'}
          </button>
        </div>
      </section>

      <style jsx global>{`
        .subscription-layout {
          min-height: 100vh;
          background: radial-gradient(circle at top, #111116 0%, #070709 100%);
          font-family: 'Inter', sans-serif;
          color: #fff;
          padding: 60px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .subscription-header {
          text-align: center;
          margin-bottom: 50px;
        }

        .logo-title {
          font-size: 38px;
          font-weight: 900;
          letter-spacing: 6px;
          margin: 0;
        }

        .subscription-subtitle {
          font-size: 13px;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-top: 8px;
        }

        .pricing-cards-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 30px;
          width: 100%;
          max-width: 1100px;
        }

        .pricing-card {
          background: rgba(20, 20, 25, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 40px;
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          position: relative;
          transition: transform 0.2s;
        }

        .pricing-card:hover {
          transform: translateY(-5px);
        }

        .highlighted-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
        }

        .badge-featured {
          position: absolute;
          top: 15px;
          right: 20px;
          background: #fff;
          color: #000;
          font-size: 9px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 1px;
        }

        .card-top {
          margin-bottom: 30px;
        }

        .card-top h3 {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 10px 0;
        }

        .price-tag {
          font-size: 38px;
          font-weight: 800;
        }

        .price-tag span {
          font-size: 14px;
          color: #a1a1aa;
          font-weight: 400;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 40px 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
          font-size: 14px;
          color: #a1a1aa;
        }

        .features-list li strong {
          color: #fff;
        }

        .card-btn {
          margin-top: auto;
          width: 100%;
          border: none;
          border-radius: 8px;
          padding: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .primary-btn {
          background: #fff;
          color: #000;
        }

        .primary-btn:hover {
          background: #e4e4e7;
        }

        .secondary-btn {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .secondary-btn:hover {
          color: #fff;
          border-color: #fff;
        }

        .card-btn:disabled {
          background: #27272a;
          color: #71717a;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
