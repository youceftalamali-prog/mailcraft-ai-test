import React, { useEffect, useRef, useState } from 'react';
import { Download, Film, ImagePlus, LoaderCircle, Mic, Play, Video, Volume2 } from 'lucide-react';

type VoiceResult = { audioDataUrl?: string; scriptText?: string; error?: string; details?: string };

export const VideoStudio: React.FC = () => {
  const [script, setScript] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [voice, setVoice] = useState('Zephyr');
  const [dialect, setDialect] = useState('general');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
  }, [videoUrl, imageUrl]);

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح.');
      return;
    }
    setError('');
    setImageName(file.name);
    setImageUrl(URL.createObjectURL(file));
    setVideoUrl((old) => { if (old) URL.revokeObjectURL(old); return ''; });
  };

  const generateVoice = async () => {
    if (!script.trim()) { setError('اكتب نص الإعلان أولاً.'); return; }
    setBusy(true); setError(''); setStatus('جارٍ توليد التعليق الصوتي عبر Gemini TTS…');
    try {
      const response = await fetch('/api/generate-voice-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: script.trim(), mode: 'literal', dialect, voice, targetAudience: 'مشاهدو الفيديوهات والإعلانات' })
      });
      const data: VoiceResult = await response.json();
      if (!response.ok || !data.audioDataUrl) throw new Error(data.error || data.details || `تعذر توليد الصوت (HTTP ${response.status})`);
      setAudioUrl(data.audioDataUrl);
      setStatus('تم توليد الصوت. يمكنك الآن إنشاء فيديو بصورة ثابتة مع التعليق الصوتي.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء توليد الصوت.');
      setStatus('');
    } finally { setBusy(false); }
  };

  const createVideo = async () => {
    if (!imageUrl) { setError('ارفع صورة المنتج أولاً.'); return; }
    if (!audioUrl) { setError('ولّد التعليق الصوتي أولاً.'); return; }
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      setError('المتصفح الحالي لا يدعم تسجيل الفيديو. جرّب أحدث إصدار من Chrome أو Edge.');
      return;
    }
    setBusy(true); setError(''); setStatus('جارٍ تركيب الفيديو في المتصفح…');
    try {
      const img = imageRef.current;
      if (!img) throw new Error('تعذر تحميل صورة المنتج.');
      if (!img.complete) await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve(); img.onerror = () => reject(new Error('تعذر تحميل صورة المنتج.'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('تعذر تهيئة محرر الفيديو.');
      const audio = new Audio(audioUrl);
      audio.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error('تعذر قراءة ملف التعليق الصوتي.'));
        audio.load();
      });
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error('المتصفح لا يدعم دمج الصوت.');
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      const stream = canvas.captureStream(30);
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('تسجيل WebM غير مدعوم في هذا المتصفح.');
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error('فشل تسجيل الفيديو.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      const draw = () => {
        ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min((canvas.width * 0.84) / img.naturalWidth, (canvas.height * 0.62) / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, canvas.height * 0.38 - h / 2, w, h);
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(79,70,229,0.28)'); gradient.addColorStop(1, 'rgba(9,13,22,0.94)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, (canvas.width - w) / 2, canvas.height * 0.38 - h / 2, w, h);
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 54px sans-serif';
        const words = script.trim().split(/\s+/); let line = ''; let y = canvas.height * 0.76;
        for (const word of words.slice(0, 28)) {
          const test = line ? line + ' ' + word : word;
          if (ctx.measureText(test).width > canvas.width * 0.82 && line) { ctx.fillText(line, canvas.width / 2, y); y += 68; line = word; }
          else line = test;
        }
        if (line) ctx.fillText(line, canvas.width / 2, y);
        ctx.fillStyle = '#c4b5fd'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('صنع خصيصًا لك', canvas.width / 2, canvas.height * 0.91);
      };
      draw();
      recorder.start(250);
      await audioContext.resume();
      await audio.play();
      const drawTimer = window.setInterval(draw, 1000 / 30);
      await new Promise<void>(resolve => { audio.onended = () => resolve(); });
      window.clearInterval(drawTimer);
      recorder.stop();
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      setVideoUrl(old => { if (old) URL.revokeObjectURL(old); return url; });
      stream.getTracks().forEach(track => track.stop());
      await audioContext.close();
      setStatus('اكتمل الفيديو. الصيغة WebM عمودية 1080×1920 مع التعليق الصوتي.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء الفيديو.');
      setStatus('');
    } finally { setBusy(false); }
  };

  return <section className="space-y-6" dir="rtl">
    <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950 via-slate-900 to-fuchsia-950 p-6 sm:p-8">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-500/20 p-3"><Film className="h-7 w-7 text-indigo-300" /></div><div><p className="text-xs font-bold tracking-widest text-indigo-300">MAILCRAFT AI • VIDEO STUDIO</p><h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">استوديو إنشاء الفيديو</h1></div></div>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">حوّل صورة المنتج ونص الإعلان إلى فيديو عمودي مع تعليق صوتي من Gemini TTS. يتم تركيب الفيديو داخل المتصفح دون رفع صورة المنتج إلى خدمة خارجية.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">1080 × 1920</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">صوت جزائري</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">تنزيل WebM</span></div>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <label className="block text-sm font-bold text-slate-200">نص الإعلان أو التعليق الصوتي<textarea value={script} onChange={e => setScript(e.target.value)} rows={6} placeholder="اكتب نص الإعلان الذي تريد أن يُقرأ كما هو…" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-7 text-white outline-none focus:border-indigo-400" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-300">اللهجة<select value={dialect} onChange={e => setDialect(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"><option value="general">جزائرية عامة</option><option value="algiers">عاصمية</option><option value="eastern">شرقية</option><option value="western">وهرانية</option><option value="sahara">صحراوية</option></select></label>
          <label className="block text-sm font-bold text-slate-300">الصوت<select value={voice} onChange={e => setVoice(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"><option value="Zephyr">Zephyr</option><option value="Kore">Kore</option><option value="Puck">Puck</option><option value="Fenrir">Fenrir</option><option value="Charon">Charon</option></select></label>
        </div>
        <button disabled={busy} onClick={generateVoice} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"><Mic className="h-4 w-4" />{busy ? 'جارٍ المعالجة…' : '1. توليد التعليق الصوتي'}</button>
        {audioUrl && <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200"><Volume2 className="h-4 w-4" /> التعليق الصوتي جاهز</div><audio controls src={audioUrl} className="w-full" /><a href={audioUrl} download="mailcraft-voice.wav" className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-300"><Download className="h-4 w-4" /> تنزيل الصوت WAV</a></div>}
      </div>
      <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div><h2 className="text-lg font-extrabold text-white">صورة المنتج</h2><p className="mt-1 text-sm text-slate-400">اختر صورة من جهازك لتكون المشهد الأساسي للفيديو.</p></div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-5 text-slate-300 hover:border-indigo-400"><ImagePlus className="h-8 w-8 text-indigo-300" /><span className="text-sm font-bold">{imageName || 'اضغط لرفع صورة المنتج'}</span><span className="text-xs text-slate-500">PNG أو JPG أو WebP</span></button>
        {imageUrl && <img ref={imageRef} src={imageUrl} alt="معاينة صورة المنتج" className="mx-auto max-h-64 rounded-xl object-contain" />}
        <button disabled={busy} onClick={createVideo} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><Video className="h-4 w-4" />{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> جارٍ إنشاء الفيديو…</> : '2. إنشاء الفيديو'}</button>
        {videoUrl && <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3"><video controls src={videoUrl} className="mx-auto max-h-[480px] rounded-lg" /><a href={videoUrl} download="mailcraft-video.webm" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"><Download className="h-4 w-4" /> تنزيل الفيديو WebM</a></div>}
      </div>
    </div>
    {status && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">{status}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    <p className="text-xs leading-6 text-slate-500">ملاحظة: هذه النسخة تركّب فيديو من صورة ثابتة ونص ظاهر وصوت؛ لا تنشئ لقطات AI متحركة، وتصدّر WebM وليس MP4. جودة الصوت تعتمد على توفر مفتاح Gemini وحصة API.</p>
  </section>;
};
