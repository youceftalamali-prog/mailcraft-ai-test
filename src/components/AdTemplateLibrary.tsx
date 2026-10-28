import React, { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, LoaderCircle, Mic, Play, Sparkles, Video } from 'lucide-react';

type TemplateId = 'luxury' | 'offer' | 'problem' | 'minimal';
type Template = { id: TemplateId; name: string; description: string; accent: string; layout: 'center' | 'split' | 'editorial' | 'bold' };

const templates: Template[] = [
  { id: 'luxury', name: 'Luxury Product', description: 'إعلان فاخر للعناية بالبشرة والعطور والمجوهرات', accent: '#d6b36a', layout: 'center' },
  { id: 'offer', name: 'Special Offer', description: 'السعر والعرض في الواجهة مع دعوة للشراء', accent: '#f97316', layout: 'bold' },
  { id: 'problem', name: 'Problem → Solution', description: 'ابدأ بالمشكلة ثم قدّم المنتج كحل', accent: '#34d399', layout: 'split' },
  { id: 'minimal', name: 'Clean Showcase', description: 'عرض بسيط وأنيق يركّز على صورة المنتج', accent: '#a5b4fc', layout: 'editorial' },
];

export const AdTemplateLibrary: React.FC = () => {
  const [selected, setSelected] = useState<TemplateId>('luxury');
  const [productName, setProductName] = useState('اسم المنتج');
  const [price, setPrice] = useState('2500 دج');
  const [headline, setHeadline] = useState('جمالك يبدأ من هنا');
  const [benefit, setBenefit] = useState('عناية يومية بلمسة من الفخامة');
  const [cta, setCta] = useState('اطلبي الآن — الدفع عند الاستلام');
  const [script, setScript] = useState('اكتشفي عنايتك الجديدة مع [اسم المنتج]. جودة وأناقة في كل استعمال. اطلبي الآن، والدفع عند الاستلام.');
  const [dialect, setDialect] = useState('algerian');
  const [voice, setVoice] = useState('Zephyr');
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [busyVoice, setBusyVoice] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string>('');

  const template = templates.find((item) => item.id === selected) ?? templates[0];

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const updateImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('يرجى اختيار صورة بصيغة صالحة.'); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setImageUrl(objectUrlRef.current);
    setImageName(file.name);
    setError('');
  };

  const resolvedScript = script.replaceAll('[اسم المنتج]', productName || 'المنتج').replaceAll('[السعر]', price || '');

  const generateVoice = async () => {
    if (!resolvedScript.trim()) { setError('اكتب نص التعليق الصوتي أولاً.'); return; }
    setBusyVoice(true); setError(''); setStatus('جارٍ توليد التعليق الصوتي…');
    try {
      const response = await fetch('/api/generate-voice-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: resolvedScript, mode: 'literal', dialect, voice, targetAudience: 'مشاهدو الإعلانات والزبائن' })
      });
      const data = await response.json() as { audioDataUrl?: string; error?: string; details?: string };
      if (!response.ok || !data.audioDataUrl) throw new Error(data.error || data.details || 'تعذر توليد الصوت.');
      setAudioUrl(data.audioDataUrl);
      setStatus('تم إنشاء التعليق الصوتي. استمع إليه ثم صدّر الفيديو.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء توليد الصوت.');
      setStatus('');
    } finally { setBusyVoice(false); }
  };

  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!imageUrl) { setError('ارفع صورة المنتج أولاً.'); return; }
    if (!('MediaRecorder' in window) || !canvas.captureStream) { setError('متصفحك لا يدعم تصدير الفيديو. جرّب Chrome أو Edge.'); return; }
    setBusyExport(true); setError(''); setStatus('جارٍ تجهيز الفيديو الإعلاني…');
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('تعذر تشغيل محرّك معاينة الفيديو.');
      const img = new Image();
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('تعذر قراءة صورة المنتج.')); });
      const width = 720, height = 1280;
      canvas.width = width; canvas.height = height;
      const stream = canvas.captureStream(30);
      let audioStream: MediaStream | null = null;
      const audioEl = audioRef.current;
      if (audioUrl && audioEl && 'captureStream' in audioEl) {
        audioEl.currentTime = 0;
        audioStream = (audioEl as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
        audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error('تعذر تسجيل الفيديو.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      const drawFrame = (time: number) => {
        const progress = Math.min(time / 10, 1);
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        if (selected === 'offer') { gradient.addColorStop(0, '#1b1110'); gradient.addColorStop(1, '#542015'); }
        else if (selected === 'problem') { gradient.addColorStop(0, '#071d1a'); gradient.addColorStop(1, '#123d35'); }
        else if (selected === 'minimal') { gradient.addColorStop(0, '#111827'); gradient.addColorStop(1, '#26334b'); }
        else { gradient.addColorStop(0, '#09090b'); gradient.addColorStop(1, '#272018'); }
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center'; ctx.direction = 'rtl';
        ctx.fillStyle = template.accent; ctx.font = '600 22px Arial'; ctx.fillText('CAMPAIGNFORGE • AD TEMPLATE', width / 2, 76);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px Arial'; ctx.fillText(headline.slice(0, 30), width / 2, 145);
        const maxW = 500, maxH = selected === 'minimal' ? 540 : 470;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * ratio, ih = img.height * ratio;
        const bob = Math.sin(time * 1.5) * 8;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30;
        ctx.drawImage(img, (width - iw) / 2, 220 + bob, iw, ih);
        ctx.restore();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px Arial'; ctx.fillText(productName.slice(0, 34), width / 2, 790);
        ctx.fillStyle = '#e5e7eb'; ctx.font = '24px Arial'; ctx.fillText(benefit.slice(0, 42), width / 2, 842);
        ctx.fillStyle = template.accent; ctx.font = 'bold 48px Arial'; ctx.fillText(price.slice(0, 20), width / 2, 925);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 25px Arial';
        const ctaText = cta.slice(0, 36);
        const buttonW = Math.min(600, Math.max(320, ctx.measureText(ctaText).width + 70));
        ctx.fillStyle = template.accent; ctx.beginPath(); ctx.roundRect((width - buttonW) / 2, 1010, buttonW, 76, 22); ctx.fill();
        ctx.fillStyle = '#111111'; ctx.fillText(ctaText, width / 2, 1058);
        ctx.fillStyle = '#cbd5e1'; ctx.font = '20px Arial'; ctx.fillText('اطلبي الآن • شحن حسب الولاية', width / 2, 1150);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(70, 1200, 580, 4);
        ctx.fillStyle = template.accent; ctx.fillRect(70, 1200, 580 * progress, 4);
      };
      recorder.start();
      if (audioUrl && audioEl && audioStream) {
        audioEl.currentTime = 0;
        await audioEl.play();
      }
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const elapsed = (now - start) / 1000;
          drawFrame(elapsed);
          if (elapsed < 10) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      recorder.stop();
      const blob = await finished;
      stream.getTracks().forEach(track => track.stop());
      audioStream?.getTracks().forEach(track => track.stop());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'campaignforge-ad-template.webm'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus('تم تصدير الفيديو بصيغة WebM. يمكنك تشغيله أو تحويله إلى MP4 عند الحاجة.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تصدير الفيديو.');
      setStatus('');
    } finally { setBusyExport(false); }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-indigo-400/20 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-pink-950/50 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-200"><Sparkles className="h-3.5 w-3.5" /> مكتبة القوالب الإعلانية</div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">اختَر قالبًا، عدّله، وصدّر إعلانك</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">قوالب قابلة لإعادة الاستخدام مع صورة المنتج والسعر والنص والتعليق الصوتي. لا تحتاج إلى توليد فيديو جديد بالذكاء الاصطناعي لكل إعلان.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300"><Video className="mb-1 h-5 w-5 text-pink-300" /> فيديو عمودي 9:16 • 10 ثوانٍ</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map((item) => (
          <button key={item.id} onClick={() => setSelected(item.id)} className={`rounded-2xl border p-4 text-right transition ${selected === item.id ? 'border-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-400/30' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}>
            <div className="mb-3 flex h-24 items-end overflow-hidden rounded-xl p-3" style={{ background: `linear-gradient(135deg, #09090b, ${item.accent}55)` }}>
              <div className="h-2 w-2/3 rounded-full" style={{ background: item.accent }} />
              <div className="ml-2 h-2 w-1/4 rounded-full bg-white/50" />
            </div>
            <div className="font-bold text-white">{item.name}</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
            {selected === item.id && <span className="mt-3 inline-block text-xs font-bold text-indigo-300">القالب المختار ✓</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="mb-4 text-lg font-bold text-white">1. معلومات المنتج</h2>
            <label className="mb-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-4 text-center hover:border-indigo-400">
              {imageUrl ? <img src={imageUrl} alt="صورة المنتج" className="max-h-48 rounded-lg object-contain" /> : <><ImagePlus className="mb-2 h-7 w-7 text-indigo-300" /><span className="font-semibold">ارفع صورة المنتج</span><span className="mt-1 text-xs text-slate-400">PNG أو JPG أو WebP</span></>}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => updateImage(event.target.files?.[0])} />
            </label>
            {imageName && <p className="mb-3 text-xs text-slate-400">{imageName}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-300">اسم المنتج<input value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" /></label>
              <label className="text-sm text-slate-300">السعر<input value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" /></label>
              <label className="text-sm text-slate-300 sm:col-span-2">العنوان الرئيسي<input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" /></label>
              <label className="text-sm text-slate-300 sm:col-span-2">الفائدة أو العبارة التوضيحية<input value={benefit} onChange={(e) => setBenefit(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" /></label>
              <label className="text-sm text-slate-300 sm:col-span-2">دعوة لاتخاذ إجراء (CTA)<input value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" /></label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="mb-4 text-lg font-bold text-white">2. نص الإعلان والصوت</h2>
            <label className="block text-sm text-slate-300">نص التعليق الصوتي<textarea value={script} onChange={(e) => setScript(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-indigo-400" /></label>
            <p className="mt-2 text-xs text-slate-500">يمكنك استعمال [اسم المنتج] و[السعر] داخل النص لاستبدالهما تلقائيًا.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-300">لغة الصوت<select value={dialect} onChange={(e) => setDialect(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option value="algerian">الدارجة الجزائرية</option><option value="general">العربية</option><option value="french">الفرنسية</option><option value="english">الإنجليزية</option></select></label>
              <label className="text-sm text-slate-300">الصوت<select value={voice} onChange={(e) => setVoice(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option value="Zephyr">Zephyr</option><option value="Kore">Kore</option><option value="Puck">Puck</option><option value="Aoede">Aoede</option><option value="Leda">Leda</option></select></label>
            </div>
            <button onClick={generateVoice} disabled={busyVoice} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{busyVoice ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}{busyVoice ? 'جارٍ توليد الصوت…' : 'توليد التعليق الصوتي'}</button>
            {audioUrl && <audio ref={audioRef} controls src={audioUrl} className="mt-3 w-full" />}
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-28 lg:col-span-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-white">معاينة القالب</h2><span className="text-xs text-slate-500">9:16</span></div>
            <div className="mx-auto max-w-[300px] overflow-hidden rounded-2xl border border-white/10 p-4 text-center shadow-2xl" style={{ background: `linear-gradient(150deg, #09090b, ${template.accent}44)` }}>
              <p className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: template.accent }}>CAMPAIGNFORGE</p>
              <h3 className="mt-3 text-xl font-black text-white">{headline || 'عنوان الإعلان'}</h3>
              <div className="my-4 flex h-56 items-center justify-center rounded-xl bg-black/20 p-3">{imageUrl ? <img ref={previewImageRef} src={imageUrl} alt={productName} className="max-h-full max-w-full object-contain drop-shadow-2xl" /> : <div className="text-sm text-slate-500">صورة المنتج تظهر هنا</div>}</div>
              <p className="font-bold text-white">{productName || 'اسم المنتج'}</p>
              <p className="mt-1 text-xs text-slate-300">{benefit}</p>
              <p className="mt-3 text-2xl font-black" style={{ color: template.accent }}>{price}</p>
              <div className="mt-3 rounded-lg px-3 py-2 text-xs font-black text-black" style={{ backgroundColor: template.accent }}>{cta}</div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={exportVideo} disabled={busyExport || !imageUrl} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{busyExport ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{busyExport ? 'جارٍ تصدير الفيديو…' : 'تصدير الفيديو الإعلاني'}</button>
            <p className="mt-2 text-xs leading-5 text-slate-500">يتم التصدير محليًا من المتصفح إلى WebM دون تكلفة توليد فيديو. أضف التعليق الصوتي قبل التصدير إذا أردت تضمينه.</p>
            {status && <p className="mt-3 text-sm text-emerald-300">{status}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
            {audioUrl && <button onClick={() => audioRef.current?.play()} className="mt-3 inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"><Play className="h-4 w-4" />استمع للتعليق الصوتي</button>}
          </div>
        </div>
      </div>
    </section>
  );
};
