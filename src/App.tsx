import React, { useEffect, useState } from 'react';
import { AccountPage, AdminPage, PricingPage } from './components/AccountPages';
import { Header } from './components/Header';
import { CampaignForm } from './components/CampaignForm';
import { CampaignDisplay } from './components/CampaignDisplay';
import { AlgerianOutroStudio } from './components/AlgerianOutroStudio';
import { ChatbotInterface } from './components/ChatbotInterface';
import { VideoStudio } from './components/VideoStudio';
import { EmailCampaign } from './types/index';
import { generateDefaultCampaign } from './utils/campaign';
import { Sparkles, AlertCircle, Wand2, Mic, MessageSquare } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [activeTab, setActiveTab] = useState<'campaign' | 'algerian_outros' | 'chat' | 'video'>('campaign');

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [campaign, setCampaign] = useState<EmailCampaign>(() =>
    generateDefaultCampaign('SaaS Product Launch with 30% Lifetime Discount')
  );
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerateCampaign = async (formData: {
    prompt: string;
    tone: string;
    audience: string;
    goal: string;
    imageSize: '1K' | '2K' | '4K';
    aspectRatio: '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
    visualStyle: string;
  }) => {
    setIsGeneratingCampaign(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: formData.prompt,
          tone: formData.tone,
          audience: formData.audience,
          goal: formData.goal,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }

      const newCampaign: EmailCampaign = await res.json();
      newCampaign.visual.imageSize = formData.imageSize;
      newCampaign.visual.aspectRatio = formData.aspectRatio;
      newCampaign.visual.style = formData.visualStyle;

      setCampaign(newCampaign);

      // Now generate the visual banner with the requested resolution affordance (1K, 2K, 4K)
      generateVisualForCampaign(newCampaign, formData.imageSize, formData.aspectRatio, formData.visualStyle);
    } catch (err: unknown) {
      console.error('Error generating campaign:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to generate campaign. Please verify connection and try again.'
      );
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const generateVisualForCampaign = async (
    targetCampaign: EmailCampaign,
    size: '1K' | '2K' | '4K',
    aspectRatio: string,
    style: string
  ) => {
    setIsGeneratingVisual(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: targetCampaign.visual.prompt,
          imageSize: size,
          aspectRatio,
          style,
        }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        setCampaign((prev) => ({
          ...prev,
          visual: {
            ...prev.visual,
            imageUrl: data.imageUrl,
            imageSize: size,
          },
        }));
      }
    } catch (err) {
      console.warn('Visual generation error:', err);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleRegenerateVisual = async (config: {
    prompt: string;
    imageSize: '1K' | '2K' | '4K';
    aspectRatio: string;
    style: string;
  }) => {
    setIsGeneratingVisual(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: config.prompt,
          imageSize: config.imageSize,
          aspectRatio: config.aspectRatio,
          style: config.style,
        }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        setCampaign((prev) => ({
          ...prev,
          visual: {
            ...prev.visual,
            imageUrl: data.imageUrl,
            imageSize: config.imageSize,
            prompt: config.prompt,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to regenerate visual:', err);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleUseAlgerianOutroInCampaign = (outroText: string) => {
    setCampaign((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        signoff: `${prev.body.signoff}\n\n🇩🇿 لمسة ختامية جزائرية: "${outroText}"`,
      },
    }));
    setActiveTab('campaign');
  };

  const handleInsertChatIntoCampaign = (text: string) => {
    setCampaign((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        mainStory: `${prev.body.mainStory}\n\n${text}`,
      },
    }));
    setActiveTab('campaign');
  };

  const handleLoadDemo = () => {
    setCampaign(generateDefaultCampaign('AI Creative Suite & Algerian Outro Voiceover'));
    setErrorMessage(null);
  };

  if (currentPath === '/login' || currentPath === '/signup') return <AccountPage key={currentPath} onNavigate={navigate} />;
  if (currentPath === '/pricing') return <PricingPage onNavigate={navigate} />;
  if (currentPath === '/admin') return <AdminPage onNavigate={navigate} />;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <div className="border-b border-slate-800/80 bg-slate-950/90">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-4 py-2 sm:px-6 lg:px-8" aria-label="Account navigation">
          <button onClick={() => navigate('/pricing')} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white">Pricing</button>
          <button onClick={() => navigate('/login')} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white">Sign in</button>
          <button onClick={() => navigate('/signup')} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400">Create account</button>
        </nav>
      </div>
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSample={handleLoadDemo}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-center justify-between gap-3 text-red-200 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline text-red-300 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: Email Campaign Studio */}
        {activeTab === 'campaign' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Form & Generator */}
              <div className="lg:col-span-5 space-y-6">
                <CampaignForm
                  onGenerate={handleGenerateCampaign}
                  isLoading={isGeneratingCampaign}
                />

                {/* Quick Feature Callouts */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    What CampaignForge Generates:
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span><strong>A/B Subject Lines:</strong> Open rate predictions &amp; psychological angles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                      <span><strong>1K/2K/4K Visuals:</strong> Powered by Gemini 3 Pro with custom aspect ratios</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>Complete HTML Copy:</strong> Hero banner, stories, bullets, social proof, CTA</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span><strong>Algerian Audio Outros:</strong> 5 regional dialects with instant WAV generation</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Campaign Output & Interactive Preview */}
              <div className="lg:col-span-7">
                <CampaignDisplay
                  campaign={campaign}
                  onUpdateCampaign={setCampaign}
                  onRegenerateVisual={handleRegenerateVisual}
                  isGeneratingVisual={isGeneratingVisual}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Algerian Outro & Voice Studio */}
        {activeTab === 'algerian_outros' && (
          <AlgerianOutroStudio
            onUseInCampaign={handleUseAlgerianOutroInCampaign}
            onNavigateToTab={setActiveTab}
          />
        )}

        {/* Tab 3: Video Studio */}
        {activeTab === 'video' && <VideoStudio />}

        {/* Tab 4: Gemini Chatbot */}
        {activeTab === 'chat' && (
          <ChatbotInterface
            onInsertToCampaign={handleInsertChatIntoCampaign}
          />
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">CampaignForge AI Studio</span>
            <span>•</span>
            <span>استوديو الحملات التسويقية والأصوات الجزائرية</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Gemini 3 Pro Image (1K, 2K, 4K)</span>
            <span>•</span>
            <span>Gemini 3.8 Flash &amp; Argon</span>
            <span>•</span>
            <span>Gemini Speech TTS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
