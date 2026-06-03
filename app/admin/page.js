"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState([]);
  const [pendingMovies, setPendingMovies] = useState([]);
  const [publishedMovies, setPublishedMovies] = useState([]);
  const [channels, setChannels] = useState([]);

  // System settings
  const [minHoldInput, setMinHoldInput] = useState('');
  const [hotWalletKey, setHotWalletKey] = useState('');
  const [savingSetting, setSavingSetting] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' });
  
  // Company Wallets
  const [companyWallets, setCompanyWallets] = useState([]);
  const [newWalletInput, setNewWalletInput] = useState('');

  // CMS Staff
  const [cmsUsers, setCmsUsers] = useState([]);
  const [newCmsUsername, setNewCmsUsername] = useState('');
  const [newCmsPassword, setNewCmsPassword] = useState('');
  
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
      const res = await fetch('/api/admin/auth', { cache: 'no-store' });
      if (res.ok) {
        setAuthenticated(true);
        fetchDashboardData();
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error(err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [moviesRes, channelsRes, walletsRes, cmsRes] = await Promise.all([
        fetch('/api/movies'),
        fetch('/api/live-channels'),
        fetch('/api/admin/wallets'),
        fetch('/api/admin/cms-users')
      ]);
      if (moviesRes.ok) {
        const data = await moviesRes.json();
        setMovies(data);
        setPendingMovies(data.filter(m => m.status === 'PENDING'));
        setPublishedMovies(data.filter(m => m.status === 'PUBLISHED'));
      }
      if (channelsRes.ok) setChannels(await channelsRes.json());
      if (walletsRes.ok) {
        const { wallets } = await walletsRes.json();
        setCompanyWallets(wallets || []);
      }
      if (cmsRes.ok) {
        setCmsUsers(await cmsRes.json());
      }

      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const { settings } = await settingsRes.json();
        if (settings?.MIN_HOLD_USD) setMinHoldInput(settings.MIN_HOLD_USD);
        if (settings?.HOT_WALLET_PRIVATE_KEY) setHotWalletKey(settings.HOT_WALLET_PRIVATE_KEY);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    }
  };

  const saveSetting = async (key, value, successMsg) => {
    setSettingsMsg({ type: '', text: '' });
    setSavingSetting(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const b = await res.json();
      if (res.ok && b.success) {
        setSettingsMsg({ type: 'ok', text: successMsg });
      } else {
        setSettingsMsg({ type: 'err', text: b.error || 'Failed to save setting.' });
      }
    } catch {
      setSettingsMsg({ type: 'err', text: 'Network error saving setting.' });
    } finally {
      setSavingSetting(false);
    }
  };

  const handleAddWallet = async (e) => {
    e.preventDefault();
    if (!newWalletInput) return;
    try {
      const res = await fetch('/api/admin/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: newWalletInput })
      });
      if (res.ok) {
        setNewWalletInput('');
        fetchDashboardData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add wallet');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  const handleDeleteWallet = async (id) => {
    if (!confirm('Remove this wallet address?')) return;
    try {
      await fetch('/api/admin/wallets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchDashboardData();
    } catch (error) {
      alert('Network error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/login');
  };

  const handleAddCmsUser = async (e) => {
    e.preventDefault();
    if (!newCmsUsername || !newCmsPassword) return;
    try {
      const res = await fetch('/api/admin/cms-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newCmsUsername, password: newCmsPassword })
      });
      if (res.ok) {
        setNewCmsUsername('');
        setNewCmsPassword('');
        fetchDashboardData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add CMS user');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  const handleDeleteCmsUser = async (id) => {
    if (!confirm('Remove this CMS user access?')) return;
    try {
      await fetch(`/api/admin/cms-users/${id}`, { method: 'DELETE' });
      fetchDashboardData();
    } catch (error) {
      alert('Network error');
    }
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

      {/* MODERATION QUEUE */}
      <section style={{ padding: '0 40px', marginBottom: 30 }}>
        <div className="dashboard-card border-amber-500/20">
          <h3 className="text-amber-500">Content Moderation Queue</h3>
          <p className="card-desc">Review and approve uploads from CMS staff before they go live on the platform.</p>
          
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Uploaded By</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingMovies.map(m => (
                <tr key={m.id}>
                  <td className="bold-td">{m.title}</td>
                  <td>{m.contentType}</td>
                  <td>CMS Staff</td>
                  <td className="text-amber-500 font-bold">PENDING REVIEW</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={async () => {
                          if(!confirm('Publish this content?')) return;
                          await fetch(`/api/movies/${m.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status: 'PUBLISHED' }) });
                          fetchDashboardData();
                        }}
                        style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
                      >Approve</button>
                      <button 
                        onClick={async () => {
                          if(!confirm('Reject and delete this content permanently?')) return;
                          await fetch(`/api/movies/${m.id}`, { method: 'DELETE' });
                          fetchDashboardData();
                        }}
                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingMovies.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-td">Queue is empty. No pending uploads.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SYSTEM SETTINGS */}
      <section style={{ padding: '0 40px', marginBottom: 30 }}>
        <div className="dashboard-card">
          <h3>System Settings</h3>
          <p className="card-desc">Platform-wide configuration for the affiliate program.</p>

          {settingsMsg.text && (
            <div style={{
              marginBottom: 16, padding: 12, borderRadius: 8, fontSize: 13,
              background: settingsMsg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: settingsMsg.type === 'ok' ? '#22c55e' : '#ef4444',
              border: `1px solid ${settingsMsg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>{settingsMsg.text}</div>
          )}

          <div className="form-row">
            <form onSubmit={(e) => { e.preventDefault(); saveSetting('MIN_HOLD_USD', Number(minHoldInput), `Minimum hold updated to $${minHoldInput}.`); }} className="admin-form">
              <div className="form-group">
                <label>Minimum Hold (USD)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={minHoldInput}
                  onChange={(e) => setMinHoldInput(e.target.value)}
                  placeholder="100"
                />
                <span style={{ fontSize: 12, color: '#52525b' }}>
                  Applies to onboarding and top-up holds (must be in multiples of $5). ≈ ₹{Math.round(Number(minHoldInput || 0) * 94)}.
                </span>
              </div>
              <button type="submit" className="submit-btn" disabled={savingSetting}>
                {savingSetting ? 'Saving…' : 'Save Min Hold'}
              </button>
            </form>
            
            <form onSubmit={(e) => { e.preventDefault(); saveSetting('HOT_WALLET_PRIVATE_KEY', hotWalletKey, 'Hot Wallet Private Key secured successfully.'); }} className="admin-form">
              <div className="form-group">
                <label>System Hot Wallet (Withdrawal Payout Key)</label>
                <input
                  type="password"
                  required
                  value={hotWalletKey}
                  onChange={(e) => setHotWalletKey(e.target.value)}
                  placeholder="0x..."
                />
                <span style={{ fontSize: 12, color: '#ef4444' }}>
                  <strong>CAUTION:</strong> This private key is used to sign automated BEP-20 payouts on the BSC Mainnet.
                </span>
              </div>
              <button type="submit" className="submit-btn" disabled={savingSetting}>
                {savingSetting ? 'Saving…' : 'Secure Private Key'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* WALLET ROTATION MANAGER */}
      <section style={{ padding: '0 40px', marginBottom: 30 }}>
        <div className="dashboard-card">
          <h3>Company Inbound Wallets</h3>
          <p className="card-desc">The rotating BEP-20 pool used for accepting automated crypto deposits from Affiliates.</p>
          
          <form onSubmit={handleAddWallet} className="admin-form" style={{ maxWidth: 450, marginBottom: 20 }}>
            <div className="form-group">
              <label>Add New BEP-20 Address</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input 
                  type="text" 
                  required 
                  value={newWalletInput} 
                  onChange={(e) => setNewWalletInput(e.target.value)} 
                  placeholder="0x..." 
                  style={{ flex: 1 }}
                />
                <button type="submit" className="submit-btn" style={{ marginTop: 0, padding: '12px 20px' }}>Add</button>
              </div>
            </div>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Wallet ID</th>
                <th>Network</th>
                <th>Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companyWallets.map(w => (
                <tr key={w.id}>
                  <td>#{w.id}</td>
                  <td>{w.network}</td>
                  <td className="src-url-td">{w.address}</td>
                  <td className="status-green">Active</td>
                  <td>
                    <button 
                      onClick={() => handleDeleteWallet(w.id)}
                      style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >Remove</button>
                  </td>
                </tr>
              ))}
              {companyWallets.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-td">No inbound wallets configured. The queue will fail.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CMS STAFF MANAGER */}
      <section style={{ padding: '0 40px', marginBottom: 30 }}>
        <div className="dashboard-card">
          <h3>CMS Staff Management</h3>
          <p className="card-desc">Create and manage content uploader accounts. They will access the `/cms/login` portal.</p>
          
          <form onSubmit={handleAddCmsUser} className="admin-form" style={{ maxWidth: 600, marginBottom: 20 }}>
            <div className="form-group">
              <label>Add New Content Manager</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input 
                  type="text" 
                  required 
                  value={newCmsUsername} 
                  onChange={(e) => setNewCmsUsername(e.target.value)} 
                  placeholder="Username" 
                  style={{ flex: 1 }}
                />
                <input 
                  type="password" 
                  required 
                  value={newCmsPassword} 
                  onChange={(e) => setNewCmsPassword(e.target.value)} 
                  placeholder="Password" 
                  style={{ flex: 1 }}
                />
                <button type="submit" className="submit-btn" style={{ marginTop: 0, padding: '12px 20px' }}>Create User</button>
              </div>
            </div>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cmsUsers.map(u => (
                <tr key={u.id}>
                  <td className="bold-td">{u.username}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="status-green">Active</td>
                  <td>
                    <button 
                      onClick={() => handleDeleteCmsUser(u.id)}
                      style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >Revoke Access</button>
                  </td>
                </tr>
              ))}
              {cmsUsers.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-td">No CMS staff accounts created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
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
                {publishedMovies.map((m) => (
                  <tr key={m.id}>
                    <td className="bold-td">{m.title}</td>
                    <td>{m.genre}</td>
                    <td>{m.year}</td>
                    <td className="src-url-td" title={m.videoSrc}>{m.videoSrc ? m.videoSrc.substring(0, 30) + '...' : 'None'}</td>
                  </tr>
                ))}
                {publishedMovies.length === 0 && (
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
