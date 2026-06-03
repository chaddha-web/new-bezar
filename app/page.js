"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CinematicPlayer from "@/components/CinematicPlayer";

/* ────────────────────────────────────────────
   VIDEO / MOVIE DATA
   videoSrc uses Lightsail bucket — update
   VIDEO_BASE if bucket URL changes.
   ──────────────────────────────────────────── */
const VIDEO_BUCKET = "https://bucket-d4d96s.s3.us-east-1.amazonaws.com";

const MOVIES = [];

const LIVE_CHANNELS = [
  {
    id: "india-daily-live",
    title: "India Daily Live",
    genre: "Hindi News",
    badge: "LIVE",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/India_Daily_24x7.png",
    videoSrc: "https://indiadaily.ottlive.co.in/indiadailylive/index.m3u8",
    description: "Breaking news, headlines, and live coverage 24/7.",
  },
  {
    id: "aaj-tak",
    title: "Aaj Tak HD",
    genre: "Hindi News",
    badge: "LIVE",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Aaj_Tak.png",
    videoSrc: "https://feeds.intoday.in/aajtak/api/aajtakhd/master.m3u8",
    description: "India's #1 Hindi news channel — live, 24/7.",
  },
  {
    id: "abp-news",
    title: "ABP News",
    genre: "Hindi News",
    badge: "LIVE",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/ABP_News.png",
    videoSrc: "https://d2l4ar6y3mrs4k.cloudfront.net/live-streaming/abpnews-livetv/master.m3u8",
    description: "Breaking news, politics, and analysis live from ABP.",
  },
  {
    id: "india-tv",
    title: "India TV",
    genre: "Hindi News",
    badge: "LIVE",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_INDIA_TV/images/LOGO_HD/image.png",
    videoSrc: "https://pl-indiatvnews.akamaized.net/out/v1/db79179b608641ceaa5a4d0dd0dca8da/index.m3u8",
    description: "India TV — Sach Dikhata Hai. Live round-the-clock.",
  },
];

/* ────────── SVG ICONS (inline) ────────── */
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
const IconChevronLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
);
const IconChevronRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);
const IconAlertTriangle = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--sale)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

/* ================================================================
   MAIN PAGE COMPONENT
   ================================================================ */
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [videoOverlay, setVideoOverlay] = useState(null);
  const [notifyModal, setNotifyModal] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // OTT Platform State variables
  const [user, setUser] = useState(null);
  const [moviesList, setMoviesList] = useState(MOVIES);
  const [resumeWatching, setResumeWatching] = useState([]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          
          // Seed watch history resume list for demonstration
          setResumeWatching([
            {
              id: 'welcome-to-the-jungle',
              title: 'Welcome To The Jungle',
              thumbnail: '/thumbnails/welcome-to-the-jungle.jpg',
              videoSrc: 'https://d2h58dsjpbzmve.cloudfront.net/50kjr%2Ffile%2F130200cb7ba80242a26d4c6e40d01842_1d5150b877ce5fa4fd0f73b36e1ee5d3.mp4',
              resumeTime: 120, // Resume at 2 minutes
              totalDuration: 180
            }
          ]);
        }
      } catch (err) {
        console.error('Failed to resolve active viewer session:', err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const res = await fetch('/api/movies');
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setMoviesList(data);
          }
        }
      } catch (err) {
        console.error('Failed to load DB movies:', err);
      }
    };
    fetchMovies();
  }, []);

  /* ── Auto-rotate hero banner every 5 seconds ── */
  useEffect(() => {
    if (videoOverlay || notifyModal) return;
    const interval = setInterval(() => {
      if (moviesList.length > 0) {
        setHeroIndex((prev) => (prev + 1) % moviesList.length);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [videoOverlay, notifyModal, moviesList]);

  /* ── Filter movies by search ── */
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const filteredMovies = moviesList.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featured = moviesList[heroIndex] || moviesList[0];

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

  /* ── Preload first few seconds of each video using hidden <video> elements ── */
  /* This avoids CORS issues since <video> tags don't require CORS headers */
  useEffect(() => {
    const preloaders = [];
    moviesList.forEach((m, i) => {
      setTimeout(() => {
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.playsInline = true;
        v.style.display = "none";
        v.src = m.videoSrc;
        document.body.appendChild(v);
        preloaders.push(v);
      }, i * 1500);
    });
    return () => {
      preloaders.forEach((v) => {
        v.src = "";
        v.remove();
      });
    };
  }, [moviesList]);

  /* ── Video overlay controls ── */
  const openVideo = useCallback((movie) => {
    setVideoOverlay(movie);
    setVideoError(false);
  }, []);

  useEffect(() => {
    if (videoOverlay && videoRef.current) {
      const video = videoRef.current;
      const isM3U8 = videoOverlay.videoSrc.endsWith(".m3u8") || videoOverlay.videoSrc.includes("m3u8") || videoOverlay.videoSrc.includes(".m3u");

      if (isM3U8) {
        import("hls.js").then((HlsModule) => {
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(videoOverlay.videoSrc);
            hls.attachMedia(video);
            hlsRef.current = hls;
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error("HLS error:", data);
              if (data.fatal) {
                setVideoError(true);
              }
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Native Safari HLS support
            video.src = videoOverlay.videoSrc;
            video.addEventListener("loadedmetadata", () => {
              video.play().catch(() => {});
            });
          } else {
            setVideoError(true);
          }
        });
      } else {
        // Regular video (MP4)
        video.src = videoOverlay.videoSrc;
        video.load();
        video.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoOverlay]);

  const closeVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setVideoOverlay(null);
    setVideoError(false);
  }, []);

  const handleVideoError = useCallback((e) => {
    console.error("Video source failed to load:", e);
    setVideoError(true);
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
      {/* ═══════ HERO CAMPAIGN TILE ═══════ */}
      {featured && (
        <section className="hero" id="hero">
          <img
            key={`hero-img-${heroIndex}`}
            className="hero-media"
            src={featured.thumbnail}
            alt={featured.title}
          />
          <div className="hero-overlay" />
          <div key={`hero-content-${heroIndex}`} className="hero-content">
            <div className="hero-badge">
              <span className="dot" />
              {featured.badge}
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

          {/* Navigation Arrows */}
          {moviesList.length > 1 && (
            <>
              <button
                className="hero-arrow hero-arrow-left"
                onClick={() => setHeroIndex((prev) => (prev - 1 + moviesList.length) % moviesList.length)}
                aria-label="Previous slide"
              >
                <IconChevronLeft />
              </button>
              <button
                className="hero-arrow hero-arrow-right"
                onClick={() => setHeroIndex((prev) => (prev + 1) % moviesList.length)}
                aria-label="Next slide"
              >
                <IconChevronRight />
              </button>
            </>
          )}

          {/* Indicator Dots */}
          {moviesList.length > 1 && (
            <div className="hero-indicators">
              {moviesList.map((_, idx) => (
                <button
                  key={idx}
                  className={`hero-dot ${idx === heroIndex ? "active" : ""}`}
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════ RESUME WATCHING GRID ═══════ */}
      {resumeWatching.length > 0 && (
        <section className="section" id="resume-watching" style={{ background: 'rgba(255,255,255,0.02)', padding: '30px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="section-header">
            <h2 className="section-title">Resume Watching</h2>
            <span className="section-count">{resumeWatching.length} Titles Incomplete</span>
          </div>

          <div className="card-grid" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {resumeWatching.map((item) => {
              const watchedPct = Math.round((item.resumeTime / item.totalDuration) * 100);
              return (
                <div 
                  className="movie-card" 
                  key={item.id} 
                  onClick={() => openVideo(item)}
                  style={{ width: '280px', cursor: 'pointer', background: 'rgba(20,20,25,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}
                >
                  <img 
                    src={item.thumbnail} 
                    alt={item.title} 
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }}
                  />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>{item.title}</h4>
                  <div className="progress-bar-bg" style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div className="progress-bar-fill" style={{ width: `${watchedPct}%`, height: '100%', background: '#60a5fa' }}></div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Watched {watchedPct}% · {Math.round(item.resumeTime / 60)}m left</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════ LIVE NEWS GRID ═══════ */}
      <section className="section" id="live-news">
        <div className="section-header">
          <h2 className="section-title">Live News</h2>
          <span className="section-count">{LIVE_CHANNELS.length} Channels</span>
        </div>

        <div className="card-grid">
          {LIVE_CHANNELS.map((channel) => (
            <div className="movie-card" key={channel.id} id={`card-${channel.id}`}>
              <div
                className="movie-card-image"
                onClick={() => openVideo(channel)}
                style={{ background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <img
                  src={channel.logo}
                  alt={channel.title}
                  loading="lazy"
                  style={{ maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }}
                />
                <div className="card-overlay" />
                <div className="play-btn">
                  <IconPlay />
                </div>
                <span className="badge-promo" style={{ background: "#e50914", color: "#fff" }}>
                  {channel.badge}
                </span>
              </div>
              <div className="movie-card-meta">
                <p className="movie-card-title">{channel.title}</p>
                <p className="movie-card-genre">{channel.genre}</p>
              </div>
            </div>
          ))}
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
          <span className="footer-copy">
            © 2026 Bezar Entertainment Pvt. Ltd. All rights reserved. · Owned &amp; operated by <strong>H.R. Moorti Crations</strong>
          </span>
          <div className="footer-legal">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Sitemap</a>
          </div>
        </div>
      </footer>

      {/* ═══════ CINEMATIC THEATER MODE OVERLAY ═══════ */}
      {videoOverlay && (
        <CinematicPlayer
          movie={videoOverlay}
          onClose={closeVideo}
          initialTime={videoOverlay.resumeTime || 0}
          userId={user?.id}
        />
      )}

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
