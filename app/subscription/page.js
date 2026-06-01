"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionPricing() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Custom mock active userId to execute purchases locally
  const mockUserId = 'a34d3ebb-78a2-4ff1-b151-ba7ad4442301';

  const handleSubscribe = async (planName, price) => {
    setLoading(true);
    try {
      // Simulate Stripe/Razorpay Payment Capture Webhook locally
      const res = await fetch('/api/checkout/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: mockUserId,
          amountPaid: price,
          sponsorId: null
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Success! You have purchased the ${planName} Plan. Premium HLS streams unlocked!`);
        router.push('/');
      } else {
        alert(data.error || 'Subscription upgrade failed');
      }
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

        {/* PREMIUM CARD */}
        <div className="pricing-card highlighted-card">
          <div className="badge-featured">RECOMMENDED</div>
          <div className="card-top">
            <h3>Premium Access</h3>
            <div className="price-tag">₹9,400 <span>/ Pack</span></div>
          </div>
          <ul className="features-list">
            <li><strong>Full-screen Cinematic Theater Mode</strong></li>
            <li>Unlimited HLS news live streams</li>
            <li>Access MLM & Network Affiliate earnings</li>
            <li>Yields multipliers up to 0.8% daily</li>
          </ul>
          <button onClick={() => handleSubscribe('Premium', 9400)} disabled={loading} className="card-btn primary-btn">
            {loading ? 'Processing Checkout...' : 'Unlock Premium Access'}
          </button>
        </div>

        {/* PLATINUM CARD */}
        <div className="pricing-card">
          <div className="card-top">
            <h3>Platinum Mogul</h3>
            <div className="price-tag">₹18,800 <span>/ Pack</span></div>
          </div>
          <ul className="features-list">
            <li>4K Cinema video playback channels</li>
            <li>Custom offline HLS stream configs</li>
            <li>Double direct commission referral tiers</li>
            <li>Accelerated 2.5x caps payouts</li>
          </ul>
          <button onClick={() => handleSubscribe('Platinum', 18800)} disabled={loading} className="card-btn secondary-btn">
            {loading ? 'Processing Checkout...' : 'Go Platinum'}
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
