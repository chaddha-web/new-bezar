'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Tv, UploadCloud, Plus, X, Video, Image as ImageIcon, 
  Tag, Star, Users, FileText, CheckCircle2, Loader2, PlayCircle, LogOut, RefreshCw 
} from 'lucide-react';

export default function CMSDashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Form State
  const [contentType, setContentType] = useState('MOVIE'); // 'MOVIE' | 'SERIES'
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [ratings, setRatings] = useState('UA');
  const [credits, setCredits] = useState('');

  // Files State
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [trailerFile, setTrailerFile] = useState(null);
  const [movieFile, setMovieFile] = useState(null); // only for MOVIE
  
  // Series Episodes
  const [episodes, setEpisodes] = useState([]); // { title, file, runtime, episode_num }

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);

  useEffect(() => {
    fetch('/api/cms/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setUsername(data.username);
        else router.push('/login');
      })
      .finally(() => setLoadingAuth(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/cms/auth', { method: 'DELETE' });
    router.push('/login');
  };

  // Helper to detect video runtime
  const detectRuntime = (file) => {
    return new Promise((resolve) => {
      if (!file) return resolve(0);
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0); // fallback
      };
      video.src = url;
    });
  };

  const generateThumbnail = async () => {
    // Determine which video to use
    let sourceFile = null;
    if (contentType === 'MOVIE' && movieFile) {
      sourceFile = movieFile;
    } else if (contentType === 'SERIES' && episodes.length > 0 && episodes[0].file) {
      sourceFile = episodes[0].file;
    } else if (trailerFile) {
      sourceFile = trailerFile;
    }

    if (!sourceFile) {
      alert("Please upload a movie, episode, or trailer video first before auto-detecting a thumbnail.");
      return;
    }

    setUploadStatus("Extracting thumbnail...");
    setUploading(true);
    setUploadProgress(0);

    try {
      const url = URL.createObjectURL(sourceFile);
      const video = document.createElement('video');
      video.muted = true;
      video.src = url;

      await new Promise((resolve, reject) => {
        video.onloadeddata = () => {
          // Seek to 5 seconds or 10% of the video
          video.currentTime = Math.min(5, video.duration * 0.1);
        };
        video.onseeked = () => resolve();
        video.onerror = (e) => reject("Error loading video for thumbnail extraction");
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      const file = new File([blob], `auto_thumbnail_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      setThumbnailFile(file);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e);
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  };

  // Helper to upload a file directly to Azure
  const uploadToAzure = async (file, purpose) => {
    if (!file) return null;
    setUploadStatus(`Uploading ${purpose}...`);
    
    // 1. Get SAS Token
    const sasRes = await fetch('/api/admin/azure-sas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, filetype: file.type })
    });
    if (!sasRes.ok) throw new Error(`Failed to get SAS token for ${file.name}`);
    
    const { uploadUrl, blobUrl, mock } = await sasRes.json();

    if (mock) {
      await new Promise(r => setTimeout(r, 1000));
      setUploadedFilesCount(prev => prev + 1);
      return blobUrl;
    }

    // 2. Upload file directly
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
      xhr.setRequestHeader("Content-Type", file.type);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 201 || xhr.status === 200) resolve();
        else reject(new Error(`Azure upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during Azure upload"));
      xhr.send(file);
    });

    setUploadProgress(0);
    setUploadedFilesCount(prev => prev + 1);
    return blobUrl;
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!thumbnailFile) return alert("Thumbnail is required.");
    if (contentType === 'MOVIE' && !movieFile) return alert("Main Movie Video is required.");
    if (contentType === 'SERIES' && episodes.length === 0) return alert("At least one episode is required for a series.");

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadedFilesCount(0);
      
      let fileCount = 1; // thumbnail
      if (trailerFile) fileCount++;
      if (contentType === 'MOVIE' && movieFile) fileCount++;
      if (contentType === 'SERIES') fileCount += episodes.length;
      setTotalFiles(fileCount);
      
      // 1. Detect runtimes
      setUploadStatus("Analyzing video lengths...");
      const movieRuntime = contentType === 'MOVIE' ? await detectRuntime(movieFile) : 0;
      
      const processedEpisodes = [];
      if (contentType === 'SERIES') {
        for (let i = 0; i < episodes.length; i++) {
          const ep = episodes[i];
          const runtime = await detectRuntime(ep.file);
          processedEpisodes.push({ ...ep, runtime });
        }
      }

      // 2. Upload files
      const thumbnailUrl = await uploadToAzure(thumbnailFile, "Thumbnail");
      const trailerUrl = trailerFile ? await uploadToAzure(trailerFile, "Trailer") : null;
      let movieUrl = null;
      
      if (contentType === 'MOVIE') {
        movieUrl = await uploadToAzure(movieFile, "Main Movie");
      }

      const finalEpisodesData = [];
      if (contentType === 'SERIES') {
        for (let i = 0; i < processedEpisodes.length; i++) {
          const ep = processedEpisodes[i];
          const epUrl = await uploadToAzure(ep.file, `Episode ${ep.episode_num}`);
          finalEpisodesData.push({
            episode_num: ep.episode_num,
            title: ep.title,
            runtime: ep.runtime,
            video_src: epUrl
          });
        }
      }

      // 3. Save to Database
      setUploadStatus("Saving metadata (Pending Review)...");
      const saveRes = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          genre,
          year,
          description,
          thumbnail: thumbnailUrl,
          videoSrc: movieUrl,
          trailerSrc: trailerUrl,
          contentType,
          runtime: movieRuntime,
          episodes: finalEpisodesData,
          tags,
          ratings,
          credits,
          badge: 'Coming Soon'
        })
      });

      if (!saveRes.ok) throw new Error("Failed to save to database");

      alert("Content uploaded successfully! It is now PENDING review by the Admin.");
      window.location.reload();

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
    }
  };

  const addEpisode = () => {
    setEpisodes([
      ...episodes, 
      { title: '', file: null, episode_num: episodes.length + 1 }
    ]);
  };

  const updateEpisode = (index, field, value) => {
    const newEps = [...episodes];
    newEps[index][field] = value;
    setEpisodes(newEps);
  };

  const removeEpisode = (index) => {
    const newEps = episodes.filter((_, i) => i !== index);
    setEpisodes(newEps.map((ep, i) => ({ ...ep, episode_num: i + 1 })));
  };

  if (loadingAuth) return <div className="cms-loading"><Loader2 size={32} className="spinner" /></div>;

  return (
    <div className="cms-container">
      <nav className="cms-navbar">
        <div className="cms-logo-area">
          <div className="cms-logo-icon">
            <PlayCircle color="white" size={20} />
          </div>
          <div className="cms-logo-text">
            <h1>BEZAR CMS</h1>
            <p>Content Manager</p>
          </div>
        </div>
        <div className="cms-user-area">
          <div className="cms-username">
            Logged in as <span>{username}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} /> Exit
          </button>
        </div>
      </nav>

      <main className="cms-main">
        <div className="cms-header">
          <h2>Upload New Content</h2>
          <p>All uploads will be placed in the Moderation Queue for Admin approval before going live.</p>
        </div>

        <form onSubmit={handlePublish}>
          <div className="content-type-selector">
            <button type="button" onClick={() => setContentType('MOVIE')} className={`type-btn ${contentType === 'MOVIE' ? 'active' : ''}`}>
              <Film size={20} /> Movie
            </button>
            <button type="button" onClick={() => setContentType('SERIES')} className={`type-btn ${contentType === 'SERIES' ? 'active' : ''}`}>
              <Tv size={20} /> Web Series
            </button>
          </div>

          <div className="grid-2">
            <div className="cms-card">
              <h3 style={{color: '#ef4444'}}><FileText size={20} /> Core Metadata</h3>
              <div className="form-group">
                <label>Title</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="form-input" placeholder="e.g. Inception" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Genre</label>
                  <input type="text" required value={genre} onChange={e => setGenre(e.target.value)} className="form-input" placeholder="Sci-Fi, Action" />
                </div>
                <div className="form-group" style={{maxWidth: '120px'}}>
                  <label>Year</label>
                  <input type="text" required value={year} onChange={e => setYear(e.target.value)} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows="4" required value={description} onChange={e => setDescription(e.target.value)} className="form-input" placeholder="Synopsis..." style={{resize: 'none'}}></textarea>
              </div>
            </div>

            <div className="cms-card">
              <h3 style={{color: '#f59e0b'}}><Tag size={20} /> Extended Details</h3>
              <div className="form-group">
                <label>Search Tags</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="form-input" placeholder="mind-bending, space, future" />
              </div>
              <div className="form-group">
                <label>Age Rating</label>
                <select value={ratings} onChange={e => setRatings(e.target.value)} className="form-input">
                  <option value="U">U (Universal)</option>
                  <option value="UA">UA (Parental Guidance)</option>
                  <option value="A">A (Adults Only)</option>
                  <option value="S">S (Special Audiences)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cast & Credits</label>
                <textarea rows="3" value={credits} onChange={e => setCredits(e.target.value)} className="form-input" placeholder="Director: Christopher Nolan..." style={{resize: 'none'}}></textarea>
              </div>
            </div>
          </div>

          <div className="cms-card media-card">
            <h3 style={{color: '#3b82f6', marginBottom: '32px'}}><UploadCloud size={24} /> Media Assets</h3>
            
            <div className="upload-grid">
              <div className="upload-box">
                <input type="file" accept="image/*" onChange={e => setThumbnailFile(e.target.files[0])} />
                <ImageIcon size={32} color="#52525b" style={{marginBottom: 12}} />
                <p>Upload Poster / Thumbnail</p>
                <small>16:9 or 2:3 JPG/PNG</small>
                <button 
                  type="button" 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); generateThumbnail(); }}
                  className="auto-detect-btn"
                >
                  <RefreshCw size={14} /> Auto-detect from Video
                </button>
                {thumbnailFile && <div className="upload-success-overlay"><span><CheckCircle2 size={18}/> Selected: {thumbnailFile.name}</span></div>}
              </div>

              <div className="upload-box amber-hover">
                <input type="file" accept="video/*" onChange={e => setTrailerFile(e.target.files[0])} />
                <Video size={32} color="#52525b" style={{marginBottom: 12}} />
                <p>Upload Trailer (Optional)</p>
                <small>MP4, MKV</small>
                {trailerFile && <div className="upload-success-overlay success-amber"><span><CheckCircle2 size={18}/> Selected: {trailerFile.name}</span></div>}
              </div>
            </div>

            {contentType === 'MOVIE' && (
              <div className="upload-box red-hover" style={{padding: '40px 24px'}}>
                <input type="file" accept="video/*" onChange={e => setMovieFile(e.target.files[0])} />
                <Film size={40} color="#52525b" style={{marginBottom: 16}} />
                <p style={{fontSize: '18px'}}>Upload Main Movie Video</p>
                <small>MP4, MKV (Full Feature)</small>
                {movieFile && <div className="upload-success-overlay success-red"><span><CheckCircle2 size={24}/> Ready: {movieFile.name}</span></div>}
              </div>
            )}

            {contentType === 'SERIES' && (
              <div className="episodes-container">
                <div className="episodes-header">
                  <h4>Episodes List</h4>
                  <button type="button" onClick={addEpisode} className="add-btn"><Plus size={16}/> Add Episode</button>
                </div>
                
                <AnimatePresence>
                  {episodes.map((ep, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="episode-row"
                    >
                      <div className="ep-num">#{ep.episode_num}</div>
                      <div style={{flex: 1}}>
                        <input type="text" required value={ep.title} onChange={e => updateEpisode(index, 'title', e.target.value)} className="form-input" placeholder="Episode Title" />
                      </div>
                      <div className="ep-file-wrapper">
                        <input type="file" required accept="video/*" onChange={e => updateEpisode(index, 'file', e.target.files[0])} style={{position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10}} />
                        <div className={`ep-file-display ${ep.file ? 'has-file' : ''}`}>
                          {ep.file ? <><CheckCircle2 size={16}/> {ep.file.name}</> : <><UploadCloud size={16}/> Select Video File</>}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeEpisode(index)} className="remove-btn">
                        <X size={20}/>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {episodes.length === 0 && <div style={{textAlign: 'center', padding: '32px', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px'}}>No episodes added yet. Click 'Add Episode' to begin.</div>}
              </div>
            )}
          </div>

          <div className="submit-bar">
            <div className="submit-info">
              Ensure all metadata is correct. Large video files may take several minutes to upload depending on your network connection.
            </div>
            <button type="submit" disabled={uploading} className="submit-btn">
              <UploadCloud size={20} /> Submit to Queue
            </button>
          </div>
        </form>
      </main>

      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="loader-overlay">
            <div className="loader-card">
              <Loader2 size={64} className="spinner" />
              <h2>Uploading Content</h2>
              <p>Please do not close this window or refresh the page. Large video files may take a while.</p>
              
              <div className="progress-text">
                <span className="status">{uploadStatus}</span>
                <span className="pct">{uploadProgress}%</span>
              </div>
              
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>

              <div className="file-count">
                File {Math.min(uploadedFilesCount + 1, totalFiles)} of {totalFiles}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        body { margin: 0; background: #000; }
        .cms-container {
          min-height: 100vh;
          background: #09090b;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          padding-bottom: 80px;
        }
        .cms-loading {
          min-height: 100vh;
          background: #09090b;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cms-navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          background: rgba(20, 20, 25, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .cms-logo-area { display: flex; align-items: center; gap: 12px; }
        .cms-logo-icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #ef4444, #f59e0b); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2); }
        .cms-logo-text h1 { font-size: 18px; font-weight: 800; letter-spacing: 1px; margin: 0; line-height: 1.2; }
        .cms-logo-text p { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; font-weight: 600; margin: 0; }
        
        .cms-user-area { display: flex; align-items: center; gap: 24px; }
        .cms-username { font-size: 14px; color: #a1a1aa; }
        .cms-username span { color: #fff; font-weight: 600; }
        .logout-btn { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: #a1a1aa; cursor: pointer; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .logout-btn:hover { color: #fff; }
        
        .cms-main { max-width: 1000px; margin: 0 auto; padding: 48px 24px; }
        .cms-header h2 { font-size: 30px; font-weight: 800; margin: 0 0 8px 0; }
        .cms-header p { color: #a1a1aa; margin: 0 0 40px 0; font-size: 15px; }
        
        .content-type-selector { display: flex; gap: 8px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 32px; }
        .type-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px; border-radius: 16px; background: transparent; border: none; color: #a1a1aa; cursor: pointer; transition: all 0.2s; font-size: 16px; font-weight: 600; }
        .type-btn.active { background: #fff; color: #000; box-shadow: 0 8px 20px rgba(255,255,255,0.15); }
        .type-btn:not(.active):hover { background: rgba(255,255,255,0.05); color: #fff; }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
        @media(max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
        
        .cms-card { background: rgba(20, 20, 25, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .media-card { background: linear-gradient(135deg, rgba(20,20,25,0.8), rgba(15,15,20,0.9)); }
        .cms-card h3 { font-size: 18px; font-weight: 700; margin: 0 0 24px 0; display: flex; align-items: center; gap: 8px; }
        
        .form-group { margin-bottom: 20px; }
        .form-row { display: flex; gap: 16px; margin-bottom: 20px; }
        .form-row .form-group { margin-bottom: 0; flex: 1; }
        .form-group label { display: block; font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .form-input { width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; color: #fff; outline: none; transition: border-color 0.2s; font-family: inherit; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { border-color: #ef4444; }
        select.form-input { appearance: none; }
        
        .upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media(max-width: 768px) { .upload-grid { grid-template-columns: 1fr; } }
        .upload-box { border: 1px dashed rgba(255,255,255,0.2); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); position: relative; cursor: pointer; transition: border-color 0.2s; overflow: hidden; text-align: center; }
        .upload-box:hover { border-color: #3b82f6; }
        .upload-box input[type="file"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; }
        .upload-box p { margin: 8px 0 0 0; font-weight: 600; font-size: 14px; }
        .upload-box small { color: #a1a1aa; font-size: 12px; margin-top: 4px; margin-bottom: 12px; }
        
        .auto-detect-btn { position: relative; z-index: 20; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s; }
        .auto-detect-btn:hover { background: rgba(255,255,255,0.2); }

        .upload-success-overlay { position: absolute; inset: 0; background: rgba(37, 99, 235, 0.2); backdrop-filter: blur(4px); border: 2px solid #3b82f6; border-radius: 16px; display: flex; align-items: center; justify-content: center; z-index: 5; }
        .upload-success-overlay span { font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        
        .upload-box.red-hover:hover { border-color: #ef4444; }
        .upload-box.amber-hover:hover { border-color: #f59e0b; }
        .success-red { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; }
        .success-amber { background: rgba(245, 158, 11, 0.2); border-color: #f59e0b; }
        
        .episodes-container { margin-top: 16px; }
        .episodes-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; margin-bottom: 16px; }
        .episodes-header h4 { margin: 0; font-size: 18px; font-weight: 700; }
        .add-btn { background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 16px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
        .add-btn:hover { background: rgba(255,255,255,0.2); }
        
        .episode-row { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
        @media(max-width: 768px) { .episode-row { flex-direction: column; align-items: stretch; } }
        .ep-num { font-size: 20px; font-weight: 700; color: #52525b; width: 40px; text-align: center; }
        .ep-file-wrapper { flex: 1; position: relative; }
        .ep-file-display { border: 1px dashed rgba(255,255,255,0.2); background: rgba(20,20,25,1); border-radius: 12px; padding: 10px 16px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #a1a1aa; font-size: 14px; font-weight: 500; transition: border-color 0.2s; height: 42px; box-sizing: border-box; }
        .ep-file-display.has-file { border-color: #22c55e; background: rgba(34, 197, 94, 0.1); color: #4ade80; border-style: solid; }
        .remove-btn { background: transparent; border: none; color: #a1a1aa; cursor: pointer; padding: 8px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .remove-btn:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        
        .submit-bar { position: sticky; bottom: 24px; z-index: 40; background: rgba(20, 20, 25, 0.9); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 16px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: space-between; }
        .submit-info { color: #a1a1aa; font-size: 14px; margin-right: 32px; flex: 1; }
        .submit-btn { background: #fff; color: #000; font-size: 16px; font-weight: 700; padding: 14px 32px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 0 20px rgba(255,255,255,0.2); transition: all 0.2s; white-space: nowrap; }
        .submit-btn:hover:not(:disabled) { background: #e5e5e5; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        
        .loader-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.9); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 32px; }
        .loader-card { background: #141419; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; width: 100%; max-width: 600px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .spinner { animation: spin 1s linear infinite; margin-bottom: 24px; color: #ef4444; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .loader-card h2 { font-size: 28px; font-weight: 800; margin: 0 0 8px 0; }
        .loader-card p { color: #a1a1aa; margin: 0 0 32px 0; font-size: 15px; max-width: 400px; }
        .progress-text { width: 100%; display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .progress-text .status { color: #a1a1aa; }
        .progress-text .pct { color: #ef4444; }
        .progress-track { width: 100%; height: 16px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; margin-bottom: 24px; position: relative; }
        .progress-fill { position: absolute; top: 0; left: 0; height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b); transition: width 0.3s ease-out; }
        .file-count { color: #a1a1aa; font-size: 14px; font-weight: 500; }
      `}</style>
    </div>
  );
}
