"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState([]);
  const [channels, setChannels] = useState([]);
  
  // Movie Form State
  const [movieTitle, setMovieTitle] = useState('');
  const [movieGenre, setMovieGenre] = useState('');
  const [movieYear, setMovieYear] = useState('2026');
  const [movieDescription, setMovieDescription] = useState('');
  const [movieThumbnail, setMovieThumbnail] = useState('');
  const [movieFile, setMovieFile] = useState(null);
  
  // Upload progress indicators
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth');
      if (res.ok) {
        setAuthenticated(true);
        fetchDashboardData();
      } else {
        router.push('/admin/login');
      }
    } catch (err) {
      console.error(err);
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [moviesRes, channelsRes] = await Promise.all([
        fetch('/api/movies'),
        fetch('/api/live-channels')
      ]);
      if (moviesRes.ok) setMovies(await moviesRes.json());
      if (channelsRes.ok) setChannels(await channelsRes.json());
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  // SECURE AZURE DIRECT UPLOAD FUNCTION
  const handleMovieSubmit = async (e) => {
    e.preventDefault();
    if (!movieFile) {
      alert("Please select a video trailer/movie file to upload.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatusText("Requesting secure Azure write token...");

    try {
      // 1. Request Azure SAS Write Token
      const sasRes = await fetch('/api/admin/azure-sas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: movieFile.name, filetype: movieFile.type })
      });

      if (!sasRes.ok) throw new Error("Could not fetch Azure SAS Token");
      const { uploadUrl, blobUrl, mock } = await sasRes.json();

      // 2. Perform direct block upload from browser to Azure Blob Storage
      setUploadStatusText(mock ? "Mock Uploading to Cloud Container..." : "Uploading directly to Azure Storage...");
      
      if (mock) {
        // Mock progress emulation for dry-runs
        for (let i = 0; i <= 100; i += 20) {
          await new Promise(r => setTimeout(r, 400));
          setUploadProgress(i);
        }
      } else {
        // Real XHR direct block upload with progress monitoring
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
          xhr.setRequestHeader("Content-Type", movieFile.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentage = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percentage);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 201 || xhr.status === 200) resolve();
            else reject(new Error("Direct upload failed with status " + xhr.status));
          };

          xhr.onerror = () => reject(new Error("Network connection error"));
          xhr.send(movieFile);
        });
      }

      setUploadStatusText("Saving title metadata to PostgreSQL...");

      // 3. Post metadata to PostgreSQL database
      const saveRes = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: movieTitle,
          genre: movieGenre,
          year: movieYear,
          description: movieDescription,
          thumbnail: movieThumbnail || '/thumbnails/default.jpg',
          videoSrc: blobUrl
        })
      });

      if (saveRes.ok) {
        alert("Movie successfully created and hosted on Azure Blob Storage!");
        setMovieTitle('');
        setMovieGenre('');
        setMovieDescription('');
        setMovieThumbnail('');
        setMovieFile(null);
        fetchDashboardData();
      } else {
        alert("Failed to register movie metadata in database.");
      }

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading Control Panel...</div>;
  }

  if (!authenticated) return null;

  return (
    <main className="admin-dashboard-container">
      {/* HEADER NAVBAR */}
      <header className="admin-navbar">
        <div className="navbar-logo">BEZAR <span>Admin Panel</span></div>
        <button onClick={handleLogout} className="logout-btn">Log Out</button>
      </header>

      {/* METRICS ROW */}
      <section className="metrics-row">
        <div className="metric-card">
          <h4>Total Movies</h4>
          <h2>{movies.length}</h2>
          <p>Hosted on Azure Container</p>
        </div>
        <div className="metric-card">
          <h4>Active Live Streams</h4>
          <h2>{channels.length}</h2>
          <p>HLS M3U8 Channels</p>
        </div>
        <div className="metric-card">
          <h4>Database Connection</h4>
          <h2 className="status-green">ONLINE</h2>
          <p>PostgreSQL Container Active</p>
        </div>
      </section>

      {/* DASHBOARD GRID */}
      <div className="dashboard-grid">
        {/* LEFT COLUMN: UPLOAD FORM */}
        <section className="dashboard-card card-form">
          <h3>Upload Movie / Trailer</h3>
          <p className="card-desc">Add a new movie title. Videos are uploaded directly to your Azure Blob Storage container.</p>
          
          <form onSubmit={handleMovieSubmit} className="admin-form">
            <div className="form-group">
              <label>Movie Title</label>
              <input type="text" required value={movieTitle} onChange={(e) => setMovieTitle(e.target.value)} placeholder="e.g. Welcome To The Jungle" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Genre</label>
                <input type="text" required value={movieGenre} onChange={(e) => setMovieGenre(e.target.value)} placeholder="e.g. Action · Comedy" />
              </div>
              <div className="form-group">
                <label>Release Year</label>
                <input type="text" required value={movieYear} onChange={(e) => setMovieYear(e.target.value)} placeholder="e.g. 2026" />
              </div>
            </div>

            <div className="form-group">
              <label>Thumbnail / Poster URL</label>
              <input type="text" value={movieThumbnail} onChange={(e) => setMovieThumbnail(e.target.value)} placeholder="e.g. /thumbnails/jungle.jpg or HTTPS URL" />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea rows="3" required value={movieDescription} onChange={(e) => setMovieDescription(e.target.value)} placeholder="Enter brief overview plot summary..." />
            </div>

            <div className="form-group">
              <label>Select Movie / Trailer Video File</label>
              <input type="file" accept="video/mp4,video/mkv,video/quicktime" onChange={(e) => setMovieFile(e.target.files[0])} />
            </div>

            {uploading && (
              <div className="progress-container">
                <div className="progress-text">
                  <span>{uploadStatusText}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <button type="submit" disabled={uploading} className="submit-btn">
              {uploading ? 'Processing Upload...' : 'Publish Title'}
            </button>
          </form>
        </section>

        {/* RIGHT COLUMN: LIST VIEW */}
        <section className="dashboard-card card-table">
          <h3>Published Titles Catalog</h3>
          <p className="card-desc">Current titles saved in your PostgreSQL database.</p>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Genre</th>
                  <th>Year</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {movies.map((m) => (
                  <tr key={m.id}>
                    <td className="bold-td">{m.title}</td>
                    <td>{m.genre}</td>
                    <td>{m.year}</td>
                    <td className="src-url-td" title={m.videoSrc}>{m.videoSrc ? m.videoSrc.substring(0, 30) + '...' : 'None'}</td>
                  </tr>
                ))}
                {movies.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-td">No movies published yet. Use the form to upload.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .admin-dashboard-container {
          min-height: 100vh;
          background: #09090b;
          color: #fff;
          font-family: 'Inter', sans-serif;
          padding-bottom: 50px;
        }

        .admin-navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          background: rgba(20, 20, 25, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .navbar-logo {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .navbar-logo span {
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #a1a1aa;
          margin-left: 10px;
          border-left: 1px solid rgba(255, 255, 255, 0.2);
          padding-left: 10px;
        }

        .logout-btn {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          color: #fff;
          border-color: #fff;
        }

        .metrics-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          padding: 40px;
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
        }

        .metric-card h4 {
          color: #a1a1aa;
          font-size: 13px;
          text-transform: uppercase;
          margin: 0 0 10px 0;
          letter-spacing: 0.5px;
        }

        .metric-card h2 {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 5px 0;
        }

        .metric-card p {
          font-size: 12px;
          color: #52525b;
          margin: 0;
        }

        .status-green {
          color: #22c55e;
          text-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 30px;
          padding: 0 40px;
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        .dashboard-card {
          background: rgba(20, 20, 25, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 30px;
          backdrop-filter: blur(10px);
        }

        .dashboard-card h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 5px 0;
        }

        .card-desc {
          color: #a1a1aa;
          font-size: 13px;
          margin: 0 0 25px 0;
          line-height: 1.5;
        }

        .admin-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group label {
          font-size: 11px;
          text-transform: uppercase;
          color: #a1a1aa;
          letter-spacing: 0.5px;
        }

        .form-group input, .form-group textarea {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
        }

        .form-group input:focus, .form-group textarea:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .submit-btn {
          background: #fff;
          color: #000;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 10px;
        }

        .submit-btn:hover {
          background: #e4e4e7;
        }

        .progress-container {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-text {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #a1a1aa;
        }

        .progress-bar-bg {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: #fff;
          transition: width 0.1s linear;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 14px;
        }

        .admin-table th {
          color: #a1a1aa;
          font-weight: 500;
          padding: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .admin-table td {
          padding: 16px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .bold-td {
          font-weight: 600;
        }

        .src-url-td {
          color: #52525b;
          font-family: monospace;
          font-size: 11px;
        }

        .empty-td {
          text-align: center;
          color: #52525b;
          padding: 40px 0 !important;
        }

        .admin-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #09090b;
          color: #a1a1aa;
          font-size: 15px;
          letter-spacing: 1px;
        }
      `}</style>
    </main>
  );
}
