"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

export default function CinematicPlayer({ movie, onClose, initialTime = 0, userId }) {
  const activeSrc = movie.isTrailer ? movie.trailerSrc : movie.videoSrc;

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Debounced tracking metrics
  const lastLoggedTimeRef = useRef(initialTime);

  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      const isM3U8 = activeSrc && (activeSrc.endsWith('.m3u8') || activeSrc.includes('m3u8'));

      if (isM3U8) {
        import('hls.js').then((HlsModule) => {
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(activeSrc);
            hls.attachMedia(video);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (initialTime > 0) video.currentTime = initialTime;
              video.play().then(() => setPlaying(true)).catch(() => {});
            });

            hls.on(Hls.Events.ERROR, () => {
              setVideoError(true);
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = activeSrc;
            video.addEventListener('loadedmetadata', () => {
              if (initialTime > 0) video.currentTime = initialTime;
              video.play().then(() => setPlaying(true)).catch(() => {});
            });
          } else {
            setVideoError(true);
          }
        });
      } else {
        // Standard MP4 handling
        video.src = activeSrc;
        video.addEventListener('loadedmetadata', () => {
          if (initialTime > 0) video.currentTime = initialTime;
          video.play().then(() => setPlaying(true)).catch(() => {});
        });
      }
    }

    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [movie, initialTime]);

  // Synchronous telemetry heartbeats logging progress to database
  const logWatchTime = useCallback(async (time, complete = false) => {
    if (!userId) return;
    const diff = Math.floor(time - lastLoggedTimeRef.current);
    
    // Log progress if viewer watched at least 10 seconds or completed video
    if (diff >= 10 || complete) {
      try {
        await fetch('/api/watch-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            movieId: movie.id,
            watchedSeconds: diff > 0 ? diff : 10,
            lastPositionSeconds: Math.floor(time)
          })
        });
        lastLoggedTimeRef.current = time;
      } catch (err) {
        console.error('Failed to log telemetry watch time:', err);
      }
    }
  }, [userId, movie]);

  // Monitor playback updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      logWatchTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
        setPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setPlaying(true);
      }
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
      } else if (e.code === 'ArrowLeft') {
        if (videoRef.current) videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
      } else if (e.code === 'KeyF') {
        if (containerRef.current) {
          if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
        }
      } else if (e.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playing, duration, onClose]);

  // Progress Bar scrubbing
  const handleScrub = (e) => {
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const targetTime = percentage * duration;
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div ref={containerRef} className="cinematic-overlay">
      <div className="theater-top-bar">
        <button onClick={onClose} className="back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          Close Theater Mode
        </button>
        <span className="movie-title-indicator">{movie.title}</span>
      </div>

      <div className="video-viewport" onClick={togglePlay}>
        {!activeSrc ? (
          <div className="premium-lock">
            <h2>Premium Content Locked</h2>
            <p>You must have an active subscription or be an active affiliate to watch this movie.</p>
            <button className="upgrade-btn" onClick={() => window.location.href = '/subscription'}>Upgrade Now</button>
          </div>
        ) : videoError ? (
          <div className="error-panel">
            <h3>Playback Error</h3>
            <p>Could not initialize HLS streams. Telemetry link is offline or blocked.</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />
        )}
      </div>

      {/* CUSTOM CONTROLLER BAR */}
      <div className={`theater-controls-hud ${showControls ? 'visible' : ''}`}>
        {/* PROGRESS TIMELINE */}
        <div className="progress-timeline-wrapper" onClick={handleScrub}>
          <div className="progress-timeline-bg">
            <div className="progress-timeline-fill" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
          </div>
        </div>

        {/* HUD INNER */}
        <div className="hud-controls-row">
          <button onClick={togglePlay} className="play-pause-btn">
            {playing ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
          </button>
          
          <div className="time-hud">
            {formatTime(currentTime)} <span className="divider">/</span> {formatTime(duration)}
          </div>
          
          <div className="audio-controls">
            <button onClick={() => setMuted(!muted)} className="mute-btn" aria-label="Mute">
              {muted || volume === 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              )}
            </button>
            <input 
              type="range" 
              className="volume-slider"
              min="0" 
              max="1" 
              step="0.05" 
              value={muted ? 0 : volume} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (val > 0 && muted) setMuted(false);
              }}
            />
          </div>
          
          <div className="shortcuts-hint">
            <span>[Space] Play/Pause</span>
            <span>[F] Fullscreen</span>
            <span>[← / →] Skip +/-10s</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .cinematic-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
        }

        .theater-top-bar {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 40px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
          z-index: 10;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          color: #a1a1aa;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }

        .back-btn:hover {
          color: #fff;
        }

        .movie-title-indicator {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
        }
        .premium-lock {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          color: white;
          text-align: center;
          padding: 20px;
          z-index: 10;
        }

        .premium-lock h2 {
          font-size: 28px;
          margin-bottom: 10px;
          color: #f59e0b;
        }

        .premium-lock p {
          color: #a1a1aa;
          margin-bottom: 24px;
        }

        .upgrade-btn {
          background: #f59e0b;
          color: #000;
          border: none;
          padding: 12px 32px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .upgrade-btn:hover {
          background: #fbbf24;
        }

        .video-viewport {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .video-viewport video {
          width: 100%;
          height: 100%;
          max-height: 100vh;
          object-fit: contain;
        }

        .error-panel {
          text-align: center;
          color: #ef4444;
        }

        .error-panel h3 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .error-panel p {
          color: #a1a1aa;
        }

        .theater-controls-hud {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          padding: 30px 40px;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
          z-index: 10;
        }

        .progress-timeline-wrapper {
          width: 100%;
          height: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }

        .progress-timeline-bg {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
          transition: height 0.1s;
        }

        .progress-timeline-wrapper:hover .progress-timeline-bg {
          height: 6px;
        }

        .progress-timeline-fill {
          height: 100%;
          background: #fff;
        }

        .hud-controls-row {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .play-pause-btn {
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: transform 0.1s;
        }

        .play-pause-btn:hover {
          transform: scale(1.1);
        }

        .time-hud {
          font-size: 14px;
          font-weight: 500;
          color: #a1a1aa;
        }

        .time-hud .divider {
          color: #52525b;
          margin: 0 4px;
        }

        .audio-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: 20px;
        }

        .mute-btn {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .mute-btn:hover {
          color: #fff;
        }

        .volume-slider {
          -webkit-appearance: none;
          width: 80px;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }

        .shortcuts-hint {
          margin-left: auto;
          display: flex;
          gap: 20px;
          font-size: 11px;
          color: #52525b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .shortcuts-hint span {
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
