'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Tv, UploadCloud, Plus, X, Video, Image as ImageIcon, 
  Tag, Star, Users, FileText, CheckCircle2, Loader2, PlayCircle, LogOut 
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

  // Hidden video player for runtime detection
  const videoRef = useRef(null);

  useEffect(() => {
    fetch('/api/cms/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setUsername(data.username);
        else router.push('/cms/login');
      })
      .finally(() => setLoadingAuth(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/cms/auth', { method: 'DELETE' });
    router.push('/cms/login');
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
          runtime: movieRuntime, // series runtime can be calculated by summing episodes later
          episodes: finalEpisodesData,
          tags,
          ratings,
          credits,
          badge: 'Coming Soon'
        })
      });

      if (!saveRes.ok) throw new Error("Failed to save to database");

      alert("Content uploaded successfully! It is now PENDING review by the Admin.");
      // Reset form (simplified for this draft)
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
    // re-number
    setEpisodes(newEps.map((ep, i) => ({ ...ep, episode_num: i + 1 })));
  };

  if (loadingAuth) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-red-500/30">
      <nav className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <PlayCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide leading-tight">BEZAR CMS</h1>
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Content Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm">
            <span className="text-neutral-400">Logged in as </span>
            <span className="font-semibold text-white">{username}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Exit</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-12 px-6">
        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-2">Upload New Content</h2>
          <p className="text-neutral-400">All uploads will be placed in the Moderation Queue for Admin approval before going live.</p>
        </div>

        <form onSubmit={handlePublish} className="space-y-8">
          
          {/* CONTENT TYPE SELECTOR */}
          <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-2 flex gap-2">
            <button
              type="button"
              onClick={() => setContentType('MOVIE')}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl transition-all ${contentType === 'MOVIE' ? 'bg-white text-black shadow-lg' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Film className="w-5 h-5" />
              <span className="font-semibold">Movie</span>
            </button>
            <button
              type="button"
              onClick={() => setContentType('SERIES')}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl transition-all ${contentType === 'SERIES' ? 'bg-white text-black shadow-lg' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Tv className="w-5 h-5" />
              <span className="font-semibold">Web Series</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* CORE METADATA */}
            <div className="space-y-6">
              <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FileText className="w-5 h-5 text-red-500"/> Core Metadata</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Title</label>
                    <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" placeholder="e.g. Inception" />
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Genre</label>
                      <input type="text" required value={genre} onChange={e => setGenre(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" placeholder="Sci-Fi, Action" />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Year</label>
                      <input type="text" required value={year} onChange={e => setYear(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Description</label>
                    <textarea rows="4" required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-none" placeholder="Synopsis..."></textarea>
                  </div>
                </div>
              </div>
            </div>

            {/* EXTENDED METADATA */}
            <div className="space-y-6">
              <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Tag className="w-5 h-5 text-amber-500"/> Extended Details</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Search Tags</label>
                    <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" placeholder="mind-bending, space, future" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Age Rating</label>
                    <select value={ratings} onChange={e => setRatings(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 text-white">
                      <option value="U">U (Universal)</option>
                      <option value="UA">UA (Parental Guidance)</option>
                      <option value="A">A (Adults Only)</option>
                      <option value="S">S (Special Audiences)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Cast & Credits</label>
                    <textarea rows="3" value={credits} onChange={e => setCredits(e.target.value)} className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-none" placeholder="Director: Christopher Nolan..."></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MEDIA UPLOADS */}
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-white/10 rounded-3xl p-8 shadow-xl">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><UploadCloud className="w-6 h-6 text-blue-500"/> Media Assets</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* THUMBNAIL */}
              <div className="border border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center bg-neutral-950/50 hover:border-blue-500/50 transition-colors group relative overflow-hidden">
                <input type="file" required accept="image/*" onChange={e => setThumbnailFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <ImageIcon className="w-8 h-8 text-neutral-500 group-hover:text-blue-500 transition-colors mb-3" />
                <p className="font-semibold text-center mb-1">Upload Poster / Thumbnail</p>
                <p className="text-xs text-neutral-500">16:9 or 2:3 JPG/PNG</p>
                {thumbnailFile && <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-sm flex items-center justify-center border-2 border-blue-500 rounded-2xl">
                  <span className="font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Selected: {thumbnailFile.name}</span>
                </div>}
              </div>

              {/* TRAILER */}
              <div className="border border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center bg-neutral-950/50 hover:border-amber-500/50 transition-colors group relative overflow-hidden">
                <input type="file" accept="video/*" onChange={e => setTrailerFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Video className="w-8 h-8 text-neutral-500 group-hover:text-amber-500 transition-colors mb-3" />
                <p className="font-semibold text-center mb-1">Upload Trailer (Optional)</p>
                <p className="text-xs text-neutral-500">MP4, MKV</p>
                {trailerFile && <div className="absolute inset-0 bg-amber-600/20 backdrop-blur-sm flex items-center justify-center border-2 border-amber-500 rounded-2xl">
                  <span className="font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Selected: {trailerFile.name}</span>
                </div>}
              </div>
            </div>

            {/* MOVIE SPECIFIC */}
            {contentType === 'MOVIE' && (
              <div className="border border-dashed border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center bg-neutral-950/50 hover:border-red-500/50 transition-colors group relative overflow-hidden">
                <input type="file" accept="video/*" onChange={e => setMovieFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Film className="w-10 h-10 text-neutral-500 group-hover:text-red-500 transition-colors mb-4" />
                <p className="font-bold text-lg text-center mb-1">Upload Main Movie Video</p>
                <p className="text-sm text-neutral-500">MP4, MKV (Full Feature)</p>
                {movieFile && <div className="absolute inset-0 bg-red-600/20 backdrop-blur-sm flex items-center justify-center border-2 border-red-500 rounded-2xl">
                  <span className="font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-6 h-6"/> Ready: {movieFile.name}</span>
                </div>}
              </div>
            )}

            {/* SERIES SPECIFIC */}
            {contentType === 'SERIES' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h4 className="font-bold text-lg">Episodes List</h4>
                  <button type="button" onClick={addEpisode} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
                    <Plus className="w-4 h-4"/> Add Episode
                  </button>
                </div>
                
                <AnimatePresence>
                  {episodes.map((ep, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="bg-neutral-950 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center"
                    >
                      <div className="font-bold text-neutral-500 text-xl w-12 text-center">#{ep.episode_num}</div>
                      
                      <div className="flex-1 w-full">
                        <input type="text" required value={ep.title} onChange={e => updateEpisode(index, 'title', e.target.value)} className="w-full bg-neutral-900 border border-transparent hover:border-white/10 focus:border-red-500 rounded-xl px-4 py-2 text-white" placeholder="Episode Title" />
                      </div>
                      
                      <div className="flex-1 w-full relative">
                        <input type="file" required accept="video/*" onChange={e => updateEpisode(index, 'file', e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className={`w-full border ${ep.file ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-dashed border-white/20 bg-neutral-900 text-neutral-400'} rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition-colors`}>
                          {ep.file ? <><CheckCircle2 className="w-4 h-4"/> {ep.file.name}</> : <><UploadCloud className="w-4 h-4"/> Select Video File</>}
                        </div>
                      </div>

                      <button type="button" onClick={() => removeEpisode(index)} className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                        <X className="w-5 h-5"/>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {episodes.length === 0 && <div className="text-center py-8 text-neutral-500 border border-dashed border-white/10 rounded-2xl">No episodes added yet. Click 'Add Episode' to begin.</div>}
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON */}
          <div className="sticky bottom-6 z-40 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between">
            <div className="flex-1 mr-8">
                <p className="text-sm text-neutral-400">Ensure all metadata is correct. Large video files may take several minutes to upload depending on your network connection.</p>
            </div>
            
            <button 
              type="submit" 
              disabled={uploading}
              className="bg-white hover:bg-neutral-200 text-black font-bold py-3 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all"
            >
              <UploadCloud className="w-5 h-5" />
              Submit to Queue
            </button>
          </div>
        </form>
      </main>

      {/* FULLSCREEN UPLOAD LOADER */}
      <AnimatePresence>
        {uploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8"
          >
            <div className="max-w-2xl w-full bg-neutral-900 border border-white/10 p-10 rounded-3xl shadow-2xl flex flex-col items-center text-center">
              <Loader2 className="w-16 h-16 text-red-500 animate-spin mb-6" />
              
              <h2 className="text-3xl font-bold mb-2">Uploading Content</h2>
              <p className="text-neutral-400 mb-8 max-w-md">Please do not close this window or refresh the page. Large video files may take a while.</p>
              
              <div className="w-full mb-2 flex justify-between text-sm font-bold uppercase tracking-wider">
                <span className="text-neutral-400">{uploadStatus}</span>
                <span className="text-red-500">{uploadProgress}%</span>
              </div>
              
              <div className="w-full h-4 bg-neutral-950 rounded-full overflow-hidden mb-6 border border-white/5 relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <div className="text-sm text-neutral-500 font-medium">
                File {Math.min(uploadedFilesCount + 1, totalFiles)} of {totalFiles}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
