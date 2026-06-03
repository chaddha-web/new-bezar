'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Tv, UploadCloud, Plus, X, Video, Image as ImageIcon, 
  Tag, FileText, CheckCircle2, Loader2, PlayCircle, LogOut, RefreshCw 
} from 'lucide-react';

export default function CMSDashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Views: COLLECTION | UPLOAD
  const [view, setView] = useState('COLLECTION');
  const [collection, setCollection] = useState([]);
  const [loadingCollection, setLoadingCollection] = useState(true);

  // Form State
  const [contentType, setContentType] = useState('MOVIE'); // 'MOVIE' | 'SERIES'
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [ratings, setRatings] = useState('UA');
  const [credits, setCredits] = useState('');

  // Assets tracking { file, url, progress, status: IDLE|UPLOADING|SUCCESS|ERROR, runtime }
  const [thumbnailAsset, setThumbnailAsset] = useState({ file: null, url: null, progress: 0, status: 'IDLE' });
  const [trailerAsset, setTrailerAsset] = useState({ file: null, url: null, progress: 0, status: 'IDLE' });
  const [movieAsset, setMovieAsset] = useState({ file: null, url: null, progress: 0, status: 'IDLE', runtime: 0 });
  const [episodes, setEpisodes] = useState([]); // { title, episode_num, file, url, progress, status, runtime }

  const [savingMetadata, setSavingMetadata] = useState(false);

  useEffect(() => {
    fetch('/api/cms/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUsername(data.username);
          fetchCollection();
        } else router.push('/login');
      })
      .finally(() => setLoadingAuth(false));
  }, []);

  const fetchCollection = async () => {
    setLoadingCollection(true);
    try {
      const res = await fetch('/api/movies');
      if (res.ok) {
        const data = await res.json();
        setCollection(data);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingCollection(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/cms/auth', { method: 'DELETE' });
    router.push('/login');
  };

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
        resolve(0);
      };
      video.src = url;
    });
  };

  const handleImmediateUpload = async (file, type, index = null) => {
    if (!file) return;

    const updateState = (update) => {
      if (type === 'THUMBNAIL') setThumbnailAsset(prev => ({ ...prev, ...update }));
      else if (type === 'TRAILER') setTrailerAsset(prev => ({ ...prev, ...update }));
      else if (type === 'MOVIE') setMovieAsset(prev => ({ ...prev, ...update }));
      else if (type === 'EPISODE' && index !== null) {
        setEpisodes(prev => {
          const newEps = [...prev];
          newEps[index] = { ...newEps[index], ...update };
          return newEps;
        });
      }
    };

    updateState({ file, progress: 0, status: 'UPLOADING', url: null });

    try {
      let runtime = 0;
      if (type !== 'THUMBNAIL') {
        runtime = await detectRuntime(file);
        if (type === 'MOVIE') updateState({ runtime });
        else if (type === 'EPISODE') updateState({ runtime });
      }

      const sasRes = await fetch('/api/admin/azure-sas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, filetype: file.type })
      });
      if (!sasRes.ok) throw new Error('Failed to get SAS');
      const { uploadUrl, blobUrl, mock } = await sasRes.json();

      if (mock) {
        await new Promise(r => setTimeout(r, 1000));
        updateState({ progress: 100, status: 'SUCCESS', url: blobUrl });
        return;
      }

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
        xhr.setRequestHeader("Content-Type", file.type);
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            updateState({ progress: Math.round((event.loaded / event.total) * 100) });
          }
        };

        xhr.onload = () => {
          if (xhr.status === 201 || xhr.status === 200) resolve();
          else reject(new Error(`Failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      updateState({ progress: 100, status: 'SUCCESS', url: blobUrl });

    } catch (e) {
      console.error(e);
      updateState({ status: 'ERROR' });
      alert(`Upload failed for ${file.name}`);
    }
  };

  const generateThumbnail = async () => {
    let sourceFile = null;
    if (contentType === 'MOVIE' && movieAsset.file) sourceFile = movieAsset.file;
    else if (contentType === 'SERIES' && episodes.length > 0 && episodes[0].file) sourceFile = episodes[0].file;
    else if (trailerAsset.file) sourceFile = trailerAsset.file;

    if (!sourceFile) {
      alert("Please select a movie, episode, or trailer video first to detect a thumbnail from.");
      return;
    }

    setThumbnailAsset(prev => ({ ...prev, status: 'UPLOADING', progress: 0 }));

    try {
      const url = URL.createObjectURL(sourceFile);
      const video = document.createElement('video');
      video.muted = true;
      video.src = url;

      await new Promise((resolve, reject) => {
        video.onloadeddata = () => {
          video.currentTime = Math.min(5, video.duration * 0.1);
        };
        video.onseeked = () => resolve();
        video.onerror = () => reject("Error loading video");
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      const file = new File([blob], `auto_thumbnail_${Date.now()}.jpg`, { type: 'image/jpeg' });
      URL.revokeObjectURL(url);
      
      handleImmediateUpload(file, 'THUMBNAIL');
    } catch (e) {
      alert(e);
      setThumbnailAsset(prev => ({ ...prev, status: 'ERROR' }));
    }
  };

  const addEpisode = () => {
    setEpisodes([
      ...episodes, 
      { title: '', episode_num: episodes.length + 1, file: null, url: null, progress: 0, status: 'IDLE', runtime: 0 }
    ]);
  };

  const updateEpisodeTitle = (index, value) => {
    const newEps = [...episodes];
    newEps[index].title = value;
    setEpisodes(newEps);
  };

  const removeEpisode = (index) => {
    const newEps = episodes.filter((_, i) => i !== index);
    setEpisodes(newEps.map((ep, i) => ({ ...ep, episode_num: i + 1 })));
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    
    if (thumbnailAsset.status !== 'SUCCESS') return alert("Thumbnail must be fully uploaded.");
    if (!trailerAsset.file || trailerAsset.status !== 'SUCCESS') return alert("Trailer is required and must be fully uploaded.");
    
    if (contentType === 'MOVIE') {
      if (movieAsset.file && movieAsset.status !== 'SUCCESS') return alert("Main Movie is still uploading.");
    } else {
      for (const ep of episodes) {
        if (ep.status !== 'SUCCESS') return alert(`Episode ${ep.episode_num} must be fully uploaded.`);
        if (!ep.title) return alert(`Episode ${ep.episode_num} needs a title.`);
      }
    }

    setSavingMetadata(true);

    try {
      const finalEpisodesData = contentType === 'SERIES' ? episodes.map(ep => ({
        episode_num: ep.episode_num,
        title: ep.title,
        runtime: ep.runtime,
        video_src: ep.url
      })) : [];

      const saveRes = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          genre,
          year,
          description,
          thumbnail: thumbnailAsset.url,
          videoSrc: contentType === 'MOVIE' ? movieAsset.url : null,
          trailerSrc: trailerAsset.url || null,
          contentType,
          runtime: contentType === 'MOVIE' ? movieAsset.runtime : 0,
          episodes: finalEpisodesData,
          tags,
          ratings,
          credits,
          badge: 'Coming Soon'
        })
      });

      if (!saveRes.ok) throw new Error("Failed to save to database");

      alert("Content published successfully! Pending Admin Review.");
      
      setView('COLLECTION');
      fetchCollection();

      // Reset
      setTitle(''); setGenre(''); setYear(new Date().getFullYear().toString()); setDescription(''); setTags(''); setCredits('');
      setThumbnailAsset({ file: null, url: null, progress: 0, status: 'IDLE' });
      setTrailerAsset({ file: null, url: null, progress: 0, status: 'IDLE' });
      setMovieAsset({ file: null, url: null, progress: 0, status: 'IDLE', runtime: 0 });
      setEpisodes([]);

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setSavingMetadata(false);
    }
  };

  const renderUploadBox = (title, accept, asset, type, index = null, icon, colorClass) => {
    return (
      <div className={`upload-box ${colorClass}`}>
        <input 
          type="file" 
          accept={accept} 
          onChange={e => handleImmediateUpload(e.target.files[0], type, index)} 
        />
        {icon}
        <p>{title}</p>
        
        {type === 'THUMBNAIL' && (
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); generateThumbnail(); }} className="auto-detect-btn">
            <RefreshCw size={14} /> Auto-detect from Video
          </button>
        )}

        {asset.status === 'UPLOADING' && (
          <div className="inline-progress-overlay">
            <div className="inline-progress-text">Uploading... {asset.progress}%</div>
            <div className="inline-progress-track">
              <div className="inline-progress-fill" style={{ width: \`\${asset.progress}%\` }}></div>
            </div>
          </div>
        )}
        
        {asset.status === 'SUCCESS' && (
          <div className="upload-success-overlay">
            <span><CheckCircle2 size={18}/> Ready: {asset.file?.name}</span>
          </div>
        )}
      </div>
    );
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
        {view === 'COLLECTION' ? (
          <div className="collection-view">
            <div className="collection-header">
              <div>
                <h2>Your Content Collection</h2>
                <p>Manage and track the status of all uploaded titles.</p>
              </div>
              <button onClick={() => setView('UPLOAD')} className="new-upload-btn">
                <Plus size={18}/> New Upload
              </button>
            </div>
            
            {loadingCollection ? (
              <div className="collection-loading"><Loader2 className="spinner" size={32}/></div>
            ) : (
              <div className="collection-grid">
                {collection.map(movie => (
                  <div key={movie.id} className="collection-card">
                    <div className="thumbnail-wrapper">
                      <img src={movie.thumbnail || '/thumbnails/default.jpg'} alt={movie.title} />
                      <div className={`status-badge ${movie.status === 'PENDING' ? 'pending' : 'published'}`}>
                        {movie.status === 'PENDING' ? 'Pending Review' : 'Published'}
                      </div>
                    </div>
                    <div className="collection-card-info">
                      <h3>{movie.title}</h3>
                      <p>
                        <span className="type-badge">{movie.contentType}</span>
                        {movie.year} • {movie.genre}
                      </p>
                    </div>
                  </div>
                ))}
                {collection.length === 0 && (
                  <div className="empty-collection">
                    <Film size={48} style={{opacity: 0.3, marginBottom: 16}} />
                    <h3>No content uploaded yet</h3>
                    <p>Get started by uploading your first movie or web series.</p>
                    <button onClick={() => setView('UPLOAD')} className="new-upload-btn" style={{marginTop: 16}}>
                      <Plus size={16}/> New Upload
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="upload-view">
            <div className="cms-header flex-header">
              <div>
                <h2>Upload New Content</h2>
                <p>Videos will start uploading immediately upon selection.</p>
              </div>
              <button onClick={() => setView('COLLECTION')} className="back-btn">
                <X size={16}/> Cancel
              </button>
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
                  {renderUploadBox("Upload Poster / Thumbnail", "image/*", thumbnailAsset, 'THUMBNAIL', null, <ImageIcon size={32} color="#52525b" style={{marginBottom: 12}} />, '')}
                  {renderUploadBox("Upload Trailer", "video/*", trailerAsset, 'TRAILER', null, <Video size={32} color="#52525b" style={{marginBottom: 12}} />, 'amber-hover')}
                </div>

                {contentType === 'MOVIE' && (
                  <div style={{marginTop: '24px'}}>
                    {renderUploadBox("Upload Main Movie Video (Optional)", "video/*", movieAsset, 'MOVIE', null, <Film size={40} color="#52525b" style={{marginBottom: 16}} />, 'red-hover massive')}
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
                        <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="episode-row">
                          <div className="ep-num">#{ep.episode_num}</div>
                          <div style={{flex: 1}}>
                            <input type="text" required value={ep.title} onChange={e => updateEpisodeTitle(index, e.target.value)} className="form-input" placeholder="Episode Title" />
                          </div>
                          
                          <div className="ep-file-wrapper" style={{position: 'relative', overflow: 'hidden'}}>
                            <input 
                              type="file" 
                              required 
                              accept="video/*" 
                              onChange={e => handleImmediateUpload(e.target.files[0], 'EPISODE', index)} 
                              style={{position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10}} 
                            />
                            
                            <div className={`ep-file-display ${ep.status === 'SUCCESS' ? 'has-file' : ''}`}>
                              {ep.status === 'IDLE' && <><UploadCloud size={16}/> Select Video File</>}
                              {ep.status === 'UPLOADING' && <span style={{color: '#3b82f6'}}>Uploading... {ep.progress}%</span>}
                              {ep.status === 'SUCCESS' && <><CheckCircle2 size={16}/> Ready: {ep.file?.name}</>}
                            </div>
                            
                            {ep.status === 'UPLOADING' && (
                              <div style={{position: 'absolute', bottom: 0, left: 0, height: '3px', background: '#3b82f6', width: \`\${ep.progress}%\`, transition: 'width 0.2s'}}></div>
                            )}
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
                  Assets begin uploading immediately when selected. Wait for all uploads to complete before submitting.
                </div>
                <button type="submit" disabled={savingMetadata} className="submit-btn">
                  {savingMetadata ? <Loader2 size={20} className="spinner" /> : <UploadCloud size={20} />} 
                  {savingMetadata ? 'Publishing...' : 'Publish Content'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

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
        
        .collection-header, .flex-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; }
        .collection-header h2, .cms-header h2 { font-size: 30px; font-weight: 800; margin: 0 0 8px 0; }
        .collection-header p, .cms-header p { color: #a1a1aa; margin: 0; font-size: 15px; }
        
        .new-upload-btn { background: #fff; color: #000; font-size: 15px; font-weight: 700; padding: 12px 24px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 0 20px rgba(255,255,255,0.15); transition: all 0.2s; }
        .new-upload-btn:hover { background: #e5e5e5; }
        .back-btn { background: rgba(255,255,255,0.1); color: #fff; padding: 10px 20px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: background 0.2s; }
        .back-btn:hover { background: rgba(255,255,255,0.15); }
        
        .collection-loading { display: flex; justify-content: center; padding: 60px; }
        
        .collection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        .collection-card { background: rgba(20,20,25,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
        .collection-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); }
        .thumbnail-wrapper { width: 100%; aspect-ratio: 16/9; position: relative; background: #000; }
        .thumbnail-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .status-badge { position: absolute; top: 12px; right: 12px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; backdrop-filter: blur(8px); }
        .status-badge.pending { background: rgba(245, 158, 11, 0.8); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .status-badge.published { background: rgba(34, 197, 94, 0.8); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .collection-card-info { padding: 16px; }
        .collection-card-info h3 { margin: 0 0 8px 0; font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .collection-card-info p { margin: 0; color: #a1a1aa; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .type-badge { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #fff; font-weight: 600; letter-spacing: 0.5px; }
        
        .empty-collection { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; background: rgba(20,20,25,0.4); border: 1px dashed rgba(255,255,255,0.1); border-radius: 24px; text-align: center; }
        .empty-collection h3 { margin: 0 0 8px 0; font-size: 20px; font-weight: 700; }
        .empty-collection p { margin: 0; color: #a1a1aa; font-size: 14px; max-width: 300px; }
        
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
        
        .upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media(max-width: 768px) { .upload-grid { grid-template-columns: 1fr; } }
        
        .upload-box { border: 1px dashed rgba(255,255,255,0.2); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); position: relative; cursor: pointer; transition: border-color 0.2s; overflow: hidden; text-align: center; }
        .upload-box.massive { padding: 40px 24px; }
        .upload-box:hover { border-color: #3b82f6; }
        .upload-box input[type="file"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; }
        .upload-box p { margin: 8px 0 0 0; font-weight: 600; font-size: 14px; }
        
        .auto-detect-btn { position: relative; z-index: 20; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s; margin-top: 12px; }
        .auto-detect-btn:hover { background: rgba(255,255,255,0.2); }

        .inline-progress-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 5; padding: 24px; }
        .inline-progress-text { color: #fff; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
        .inline-progress-track { width: 100%; max-width: 200px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; }
        .inline-progress-fill { height: 100%; background: #3b82f6; transition: width 0.2s ease; }
        
        .upload-success-overlay { position: absolute; inset: 0; background: rgba(37, 99, 235, 0.2); backdrop-filter: blur(4px); border: 2px solid #3b82f6; border-radius: 16px; display: flex; align-items: center; justify-content: center; z-index: 5; }
        .upload-success-overlay span { font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        
        .upload-box.red-hover:hover { border-color: #ef4444; }
        .upload-box.amber-hover:hover { border-color: #f59e0b; }
        
        .episodes-container { margin-top: 24px; }
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
        
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
