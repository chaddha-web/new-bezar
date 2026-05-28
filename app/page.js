"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ────────────────────────────────────────────
   VIDEO / MOVIE DATA
   videoSrc uses Lightsail bucket — update
   VIDEO_BASE if bucket URL changes.
   ──────────────────────────────────────────── */
const VIDEO_BUCKET = "https://bucket-d4d96s.s3.us-east-1.amazonaws.com";

const MOVIES = [
  {
    id: "welcome-to-the-jungle",
    title: "Welcome To The Jungle",
    genre: "Action · Comedy",
    year: "2026",
    badge: "Coming Soon",
    thumbnail: "/thumbnails/welcome-to-the-jungle.jpg",
    videoSrc: `${VIDEO_BUCKET}/welcome-to-the-jungle.mp4`,
    featured: true,
    description:
      "The wildest adventure of the year — arriving June 26, 2026.",
  },
  {
    id: "dangal",
    title: "Dangal",
    genre: "Drama · Sport",
    year: "2016",
    badge: "Just In",
    thumbnail: "/thumbnails/dangal.jpg",
    videoSrc: `${VIDEO_BUCKET}/dangal.mp4`,
    description: "A father's dream. A daughter's destiny.",
  },
  {
    id: "disclosure-day",
    title: "Disclosure Day",
    genre: "Sci-Fi · Thriller",
    year: "2025",
    badge: "Coming Soon",
    thumbnail: "/thumbnails/disclosure-day.jpg",
    videoSrc: `${VIDEO_BUCKET}/disclosure-day.mp4`,
    description: "The truth was never meant to be found.",
  },
  {
    id: "governor",
    title: "Governor",
    genre: "Political Thriller",
    year: "2025",
    badge: "Coming Soon",
    thumbnail: "/thumbnails/governor.jpg",
    videoSrc: `${VIDEO_BUCKET}/governor.mp4`,
    description: "Power has a price. Every seat costs a soul.",
  },
  {
    id: "gully-boy",
    title: "Gully Boy",
    genre: "Drama · Music",
    year: "2019",
    badge: "Just In",
    thumbnail: "/thumbnails/gully-boy.jpg",
    videoSrc: `${VIDEO_BUCKET}/gully-boy.mp4`,
    description: "From the streets to the stage.",
  },
];

/* ────────── SVG ICONS (inline) ────────── */
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconPlay = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconBell = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconCheck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);

/* ================================================================
   MAIN PAGE COMPONENT
   ================================================================ */
export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [videoOverlay, setVideoOverlay] = useState(null);
  const [notifyModal, setNotifyModal] = useState(null);
  const [search, setSearch] = useState("");
  const [videoUrls, setVideoUrls] = useState({});
  const videoRef = useRef(null);

  /* ── Fetch signed URLs on mount ── */
  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls = {};
      await Promise.all(
        MOVIES.map(async (m) => {
          try {
            const filename = m.videoSrc.split("/").pop();
            const res = await fetch(`/api/video-url?filename=${encodeURIComponent(filename)}`);
            const data = await res.json();
            urls[m.id] = data.url;
          } catch (err) {
            console.error("Failed to load signed URL for:", m.title, err);
            urls[m.id] = m.videoSrc; // fallback to public URL
          }
        })
      );
      setVideoUrls(urls);
    };
    fetchSignedUrls();
  }, []);

  /* ── Filter movies by search ── */
  const filteredMovies = MOVIES.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.genre.toLowerCase().includes(search.toLowerCase())
  );

  const featured = MOVIES.find((m) => m.featured) || MOVIES[0];

  /* ── Sequential card reveal on scroll ── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".movie-card").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filteredMovies]);

  /* ── Register Service Worker for video caching ── */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  /* ── Preload first ~2MB of each video (5-10s buffer) ── */
  useEffect(() => {
    if (Object.keys(videoUrls).length === 0) return;
    const preloadVideo = async (url, delay) => {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetch(url, {
          headers: { Range: "bytes=0-2097151" },
          mode: "cors",
        });
        // Read and discard — the SW or browser cache now holds it
        if (res.ok || res.status === 206) await res.blob();
      } catch {
        // silent fail — non-critical preload
      }
    };
    // Stagger preloads so we don't hammer the connection
    MOVIES.forEach((m, i) => {
      const url = videoUrls[m.id];
      if (url) {
        preloadVideo(url, i * 1500);
      }
    });
  }, [videoUrls]);

  /* ── Video overlay controls ── */
  const openVideo = useCallback((movie) => {
    setVideoOverlay(movie);
  }, []);

  useEffect(() => {
    if (videoOverlay && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [videoOverlay]);

  const closeVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setVideoOverlay(null);
  }, []);

  /* ── Keyboard: Esc to close ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        closeVideo();
        setNotifyModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeVideo]);

  /* Lock body scroll when overlay or modal open */
  useEffect(() => {
    document.body.style.overflow =
      videoOverlay || notifyModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [videoOverlay, notifyModal]);

  return (
    <>
      {/* ═══════ UTILITY BAR ═══════ */}
      <div className="utility-bar">
        <a href="#">Download App</a>
        <span className="sep">|</span>
        <a href="#">Help</a>
        <span className="sep">|</span>
        <a href="#">Join Us</a>
        <span className="sep">|</span>
        <a href="#">Sign In</a>
      </div>

      {/* ═══════ PRIMARY NAV ═══════ */}
      <nav className="primary-nav">
        <button
          className={`nav-hamburger ${drawerOpen ? "open" : ""}`}
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-label="Menu"
        >
          <span />
        </button>

        <a href="/" className="nav-brand">Bezar</a>

        <div className="nav-links">
          <a href="#" className="active">Home</a>
          <a href="#">Movies</a>
          <a href="#">Series</a>
          <a href="#">Sports</a>
          <a href="#">Originals</a>
        </div>

        <div className="nav-right">
          <div className="search-pill">
            <IconSearch />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="search-input"
            />
          </div>
        </div>
      </nav>

      {/* ═══════ MOBILE DRAWER ═══════ */}
      <div className={`mobile-drawer ${drawerOpen ? "open" : ""}`}>
        <a href="#" onClick={() => setDrawerOpen(false)}>Home</a>
        <a href="#" onClick={() => setDrawerOpen(false)}>Movies</a>
        <a href="#" onClick={() => setDrawerOpen(false)}>Series</a>
        <a href="#" onClick={() => setDrawerOpen(false)}>Sports</a>
        <a href="#" onClick={() => setDrawerOpen(false)}>Originals</a>
      </div>

      {/* ═══════ HERO CAMPAIGN TILE ═══════ */}
      <section className="hero" id="hero">
        <img
          className="hero-media"
          src={featured.thumbnail}
          alt={featured.title}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="dot" />
            Coming Soon
          </div>
          <h1 className="hero-title">{featured.title}</h1>
          <p className="hero-subtitle">{featured.description}</p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={() => openVideo(featured)}
              id="hero-play-btn"
            >
              <IconPlay /> Watch Trailer
            </button>
            <button
              className="btn-icon"
              onClick={() => setNotifyModal(featured)}
              aria-label="Get notified"
              id="hero-notify-btn"
            >
              <IconBell />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ COMING SOON GRID ═══════ */}
      <section className="section" id="coming-soon">
        <div className="section-header">
          <h2 className="section-title">Coming Soon</h2>
          <span className="section-count">{filteredMovies.length} Titles</span>
        </div>

        <div className="card-grid">
          {filteredMovies.map((movie) => (
            <div className="movie-card" key={movie.id} id={`card-${movie.id}`}>
              <div
                className="movie-card-image"
                onClick={() => openVideo(movie)}
              >
                <img src={movie.thumbnail} alt={movie.title} loading="lazy" />
                <div className="card-overlay" />
                <div className="play-btn">
                  <IconPlay />
                </div>
                <span className="badge-promo">{movie.badge}</span>
              </div>
              <div className="movie-card-meta">
                <p className="movie-card-title">{movie.title}</p>
                <p className="movie-card-genre">
                  {movie.genre} · {movie.year}
                </p>
                <div className="movie-card-actions">
                  <button
                    className="btn-notify-sm"
                    onClick={() => setNotifyModal(movie)}
                    id={`notify-${movie.id}`}
                  >
                    <IconBell /> Notify Me
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ NOTIFY / EMAIL SECTION ═══════ */}
      <section className="notify-section" id="notify-section">
        <div className="notify-inner">
          <h2 className="section-title">Stay In The Loop</h2>
          <p className="section-subtitle">
            Be the first to know when Bezar launches. Get exclusive early access,
            premiere alerts, and behind-the-scenes content straight to your inbox.
          </p>
          <EmailForm id="footer-email-form" />
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="footer" id="footer">
        <div className="footer-grid">
          <div className="footer-col">
            <p className="footer-col-title">Bezar</p>
            <a href="#">About Us</a>
            <a href="#">Careers</a>
            <a href="#">Press</a>
            <a href="#">Investors</a>
          </div>
          <div className="footer-col">
            <p className="footer-col-title">Help</p>
            <a href="#">Support Centre</a>
            <a href="#">Contact Us</a>
            <a href="#">FAQ</a>
            <a href="#">Device Compatibility</a>
          </div>
          <div className="footer-col">
            <p className="footer-col-title">Legal</p>
            <a href="#">Terms of Use</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Cookie Preferences</a>
            <a href="#">Accessibility</a>
          </div>
          <div className="footer-col">
            <p className="footer-col-title">Connect</p>
            <a href="#">Instagram</a>
            <a href="#">Twitter / X</a>
            <a href="#">YouTube</a>
            <a href="#">LinkedIn</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© 2026 Bezar Entertainment Pvt. Ltd. All rights reserved.</span>
          <div className="footer-legal">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Sitemap</a>
          </div>
        </div>
      </footer>

      {/* ═══════ VIDEO PLAYER OVERLAY ═══════ */}
      <div
        className={`video-overlay ${videoOverlay ? "active" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeVideo(); }}
        id="video-overlay"
      >
        <button className="close-btn" onClick={closeVideo} aria-label="Close video">
          <IconX />
        </button>
        <div className="video-player-container">
          {videoOverlay && (
            <video
              ref={videoRef}
              controls
              playsInline
              preload="auto"
            >
              <source src={videoUrls[videoOverlay.id] || videoOverlay.videoSrc} type="video/mp4" />
            </video>
          )}
          {videoOverlay && (
            <span className="video-player-title">{videoOverlay.title}</span>
          )}
        </div>
      </div>

      {/* ═══════ NOTIFY MODAL ═══════ */}
      <NotifyModal
        movie={notifyModal}
        onClose={() => setNotifyModal(null)}
      />
    </>
  );
}

/* ================================================================
   EMAIL FORM (inline — used in the dark notify section)
   ================================================================ */
function EmailForm({ id }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    // Persist to localStorage
    const existing = JSON.parse(localStorage.getItem("bezar_emails") || "[]");
    if (!existing.includes(email)) {
      existing.push(email);
      localStorage.setItem("bezar_emails", JSON.stringify(existing));
    }
    setSubmitted(true);
  };

  return (
    <>
      <form
        className={`email-form ${submitted ? "hidden" : ""}`}
        onSubmit={handleSubmit}
        id={id}
      >
        <input
          className="email-input"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          id={`${id}-input`}
        />
        <button className="btn-primary" type="submit" id={`${id}-submit`}>
          <IconMail /> Notify Me
        </button>
      </form>
      <div className={`email-success ${submitted ? "show" : ""}`}>
        <IconCheck /> You&apos;re on the list — we&apos;ll be in touch.
      </div>
    </>
  );
}

/* ================================================================
   NOTIFY MODAL (per-movie)
   ================================================================ */
function NotifyModal({ movie, onClose }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!movie) {
      setEmail("");
      setDone(false);
    }
  }, [movie]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    const existing = JSON.parse(localStorage.getItem("bezar_emails") || "[]");
    const entry = `${email}|${movie?.id}`;
    if (!existing.includes(entry) && !existing.includes(email)) {
      existing.push(entry);
      localStorage.setItem("bezar_emails", JSON.stringify(existing));
    }
    setDone(true);
  };

  return (
    <div
      className={`modal-overlay ${movie ? "active" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      id="notify-modal"
    >
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconX />
        </button>

        <div className={`modal-form ${done ? "hidden" : ""}`}>
          <h3 className="modal-title">Get Notified</h3>
          <p className="modal-subtitle">
            {movie
              ? `We'll email you when "${movie.title}" is available to stream on Bezar.`
              : "Sign up for launch alerts."}
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              className="modal-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              id="modal-email-input"
            />
            <button className="btn-primary-dark" type="submit" id="modal-submit-btn">
              Notify Me
            </button>
          </form>
        </div>

        <div className={`modal-success ${done ? "show" : ""}`}>
          <div className="check-circle"><IconCheck /></div>
          <p>You&apos;re all set!</p>
          <span>We&apos;ll notify you when {movie?.title} drops.</span>
        </div>
      </div>
    </div>
  );
}
