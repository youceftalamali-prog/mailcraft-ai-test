import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Shared server-side Gemini client with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Generate complete email marketing campaign
app.post('/api/generate-campaign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, tone, audience, goal } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const systemPrompt = `You are an elite, conversion-focused Direct Response Email Marketing Copywriter.
Create a complete, comprehensive email marketing campaign based on the user's brief.
Ensure high click-through rates, compelling hooks, empathetic storytelling, and crystal clear call to actions.
If the user's prompt is in Arabic or French or English, tailor the output appropriately while maintaining the structured JSON schema.`;

    const userPrompt = `Campaign Brief:
Topic / Product: "${prompt}"
Target Audience: "${audience || 'Decision makers and passionate consumers'}"
Tone of Voice: "${tone || 'Persuasive, authoritative, inspiring'}"
Campaign Objective: "${goal || 'Drive immediate action and brand loyalty'}"

Generate:
1. 3 highly distinct subject lines with open rate score (0-100), strategic angle, and preview preheader text.
2. Full email body with hero greeting, attention-grabbing headline, subheadline, 3-paragraph compelling narrative story, 3 key bullet points with titles and descriptions, believable social proof quote with author and role, high-converting primary CTA with button text and URL, secondary hesitation-remover text, urgency banner, signoff, sender name, company name, and address.
3. A detailed visual hero image prompt tailored for a hero banner, with visual style.
4. A 3-step drip sequence showing how this email fits into a nurture funnel.`;

    let responseText = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    for (const m of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: unknown) {
        console.warn(`Model ${m} failed for campaign generation:`, (err as Error).message);
      }
    }

    let parsed: Record<string, any> = {};
    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = {};
      }
    }

    // If models were 503 or empty, provide deterministic high-converting content
    if (!parsed.name || !parsed.body) {
      parsed = createDeterministicCampaign(prompt, tone, audience, goal);
    }

    const campaignId = 'camp-' + Date.now();

    res.json({
      id: campaignId,
      ...parsed,
      selectedSubjectIndex: 0,
      visual: {
        prompt: parsed.visual?.prompt || `A sleek visual banner for ${prompt}`,
        aspectRatio: '16:9',
        imageSize: '2K',
        imageUrl: '',
        style: parsed.visual?.style || 'Cinematic 3D Modern',
      },
      createdAt: Date.now(),
    });
  } catch (err: unknown) {
    console.error('Error generating campaign:', err);
    res.status(500).json({
      error: 'Failed to generate campaign',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Endpoint: Generate high-resolution email visuals with 1K, 2K, 4K affordance
// Uses model gemini-3-pro-image-preview as required
app.post('/api/generate-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, aspectRatio = '16:9', imageSize = '2K', style = 'Cinematic 3D Modern' } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const enhancedPrompt = `${prompt}. Visual style: ${style}. Clean corporate email marketing hero banner, master composition, ultra high detail, commercial advertising quality, resolution: ${imageSize}.`;

    // Target models list in priority order: gemini-3-pro-image-preview requested by user
    const modelsToTry = [
      'gemini-3-pro-image-preview',
      'gemini-3-pro-image',
      'gemini-nano-banana-2.1',
      'gemini-3.1-flash-lite-image',
    ];

    let imageUrl = '';
    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        const config: Record<string, unknown> = {
          imageConfig: {
            aspectRatio: ['16:9', '1:1', '4:3', '3:4', '9:16'].includes(aspectRatio) ? aspectRatio : '16:9',
          },
        };

        // If using pro or nano banana models, add imageSize affordance (1K, 2K, 4K)
        if (modelName !== 'gemini-3.1-flash-lite-image') {
          (config.imageConfig as Record<string, unknown>).imageSize = ['1K', '2K', '4K'].includes(imageSize)
            ? imageSize
            : '2K';
        }

        const imageResponse = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [{ text: enhancedPrompt }],
          },
          config,
        });

        const parts = imageResponse.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          console.log(`Successfully generated image using ${modelName} at ${imageSize}`);
          break;
        }
      } catch (err: unknown) {
        console.warn(`Model ${modelName} failed or not accessible:`, (err as Error).message);
        lastError = err as Error;
      }
    }

    if (imageUrl) {
      res.json({ imageUrl, success: true, imageSize, aspectRatio });
      return;
    }

    // Fallback: Generate an artistic SVG hero banner with canvas gradient and badge
    console.log('Generating high-fidelity SVG hero banner fallback');
    const svgBanner = generateFallbackSvgBanner(prompt, style, imageSize);
    res.json({
      imageUrl: svgBanner,
      success: true,
      imageSize,
      aspectRatio,
      fallbackUsed: true,
      note: lastError?.message || 'Generated via fallback visual renderer',
    });
  } catch (err: unknown) {
    console.error('Error generating image:', err);
    res.status(500).json({
      error: 'Failed to generate visual',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Endpoint: Unified Algerian Script Generation & Direct TTS Voiceover Pipeline
// Supports two modes:
// - mode: 'literal' (default) → speak the user's exact text without rewriting/summarizing
// - mode: 'generate_outro' → generate a short Algerian outro (previous behavior)
app.post('/api/generate-voice-script', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      prompt,
      dialect = 'general',
      voice = 'Zephyr',
      tone,
      targetAudience,
      mode = 'literal',
      emotionId = 'confident_persuasive',
      intensity = 55,
      pace = 1.0,
      pauses = true,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt or script draft is required' });
      return;
    }

    const userText = prompt.trim();
    const validVoice = ['Kore', 'Puck', 'Fenrir', 'Zephyr', 'Charon'].includes(voice) ? voice : 'Zephyr';
    const generationMode: 'literal' | 'generate_outro' =
      mode === 'generate_outro' ? 'generate_outro' : 'literal';

    const deliverySettings = {
      emotionId: typeof emotionId === 'string' ? emotionId : 'confident_persuasive',
      intensity: Number.isFinite(Number(intensity)) ? Math.min(100, Math.max(0, Number(intensity))) : 55,
      pace: Number.isFinite(Number(pace)) ? Math.min(1.35, Math.max(0.75, Number(pace))) : 1.0,
      pauses: pauses !== false && pauses !== 'false',
    };

    // Map dialect parameter to dialect info and precise linguistic guidelines
    // IMPORTANT: Algiers (algiers / Zephyr) rules are left completely unchanged.
    let dialectLabel = 'الدارجة الجزائرية العامة';
    let dialectRule =
      'لهجة جزائرية وسطى عامة مفهومة في كامل الـ 58 ولاية (يعطيكم الصحة، متنساوش الاشتراك واللايك، بارطاجيو الفيديو، تهلاو في رواحكم).';

    if (dialect === 'algiers' || dialect.includes('العاصمي') || dialect.includes('alger')) {
      dialectLabel = 'العاصمي (الوسط)';
      dialectRule =
        'اللهجة العاصمية والوسط الجزائري: كلمات مميزة مثل (خاوتي وخواتاتي، ما تنساوش ديرو جيم وابوني، نتلاقاو فالعدد الجاي بحول الله، تهلاو ف رواحتكم.. سلام). نبرة دافئة وودودة وخفيفة.';
    } else if (
      dialect === 'eastern' ||
      dialect.includes('الشرقي') ||
      dialect.includes('قسنطين') ||
      dialect.includes('عناب')
    ) {
      dialectLabel = 'الشرقي - قسنطيني / عنابي';
      dialectRule =
        'اللهجة الشرقية (قسنطينة، عنابة، سطيف): كلمات مميزة مثل (عيشكم، ربي يحفظكم كاملين، المتابعة الطيبة، ف أمان الله، دمتم سالمين). نبرة رزينة وأصيلة وفخمة.';
    } else if (
      dialect === 'western' ||
      dialect.includes('الغربي') ||
      dialect.includes('وهران') ||
      dialect.includes('oran')
    ) {
      dialectLabel = 'الغربي - وهراني';
      dialectRule =
        'اللهجة الغربية (وهران والغرب الجزائري): كلمات مميزة مثل (حبابنا الزينين، يعطيكم ألف صحة، فجروا زر اللايك، بزّاف، تهلاو ف رواحكم وبسلامة). نبرة حماسية عالية الطاقة وشبابية.';
    } else if (
      dialect === 'sahara' ||
      dialect.includes('صحراوي') ||
      dialect.includes('تراثي') ||
      dialect.includes('شعبي')
    ) {
      dialectLabel = 'تراتي وشعبي / صحراوي';
      dialectRule =
        'اللهجة الصحراوية والتراثية الشعبية: كلمات أصيلة مثل (عاش من شافكم وسمع صوتكم، ربي يلاقينا ف ساعة الخير، تباتوا ف أمان ربي، كرم وأصالة). نبرة حكيمة ودافئة.';
    }

    let parsedData: Record<string, any> = {};
    let textForTts = userText;
    let quotaExceeded = false;

    if (generationMode === 'generate_outro') {
      // Previous behavior: AI generates a short outro based on the topic
      const systemPrompt = `أنت خبير محترف في اللهجات الجزائرية وصناعة المحتوى الصوتي (Voiceover & Outros).
مهمتك كتابة خاتمة فيديو أو سكريبت صوتي إبداعي بالدارجة الجزائرية المختارة بدقة:
- اللهجة المطلوبة: ${dialectLabel}
- قواعد اللهجة: ${dialectRule}
- النبرة والهدف: ${tone || 'خاتمة فيديو جذابة تحث على التفاعل (Call-To-Action)'}
- الجمهور المستهدف: ${targetAudience || 'متابعو يوتيوب، تيك توك، ريلز إنستغرام أو متسوقون عبر الإنترنت'}

المطلوب إخراجه كـ JSON:
1. scriptText: النص المكتوب بالدارجة الجزائرية الطبيعية ليقرأه المستخدم. لا تُدرج ملاحظات إخراج أو أقواساً مثل [بصوت حماسي].
2. phoneticText: نفس النص مع تشكيل حركات النطق بدقة (الفتحة والضمة والكسرة والشدة والسكون) لضمان أن ينطقها محرك الصوت TTS كدارجة جزائرية صحيحة دون أخطاء نطق.
3. catchyTitle: عنوان معبر للخاتمة (3-5 كلمات).
4. deliveryStyle: توجيهات الأداء الصوتي (النبرة، الطاقة، والسرعة).
5. callToAction: الإجراء المطلوب من المشاهد (لايك، اشتراك، شراء، تعليق).
6. durationEstimate: مدة الإلقاء المقدرة بالثواني (مثال: 12-15 ثانية).`;

      const userMessage = `موضوع الفيديو أو السكريبت المطلوب: "${userText}". صغ خاتمة قوية بالدارجة ${dialectLabel}.`;

      // Single text model attempt — do not cascade on 429 quota
      const textModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
      for (const m of textModels) {
        if (quotaExceeded) break;
        try {
          const textResponse = await ai.models.generateContent({
            model: m,
            contents: userMessage,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
            },
          });
          if (textResponse.text) {
            parsedData = JSON.parse(textResponse.text);
            break;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`Model ${m} failed for voice script:`, msg);
          if (isQuotaOrRateLimitError(msg)) {
            quotaExceeded = true;
            break;
          }
        }
      }

      if (quotaExceeded) {
        res.status(429).json({
          error: 'انتهت حصة الاستخدام (Quota) أو تم تجاوز حد الطلبات. يرجى الانتظار ثم المحاولة لاحقاً.',
          code: 'QUOTA_EXCEEDED',
          mode: generationMode,
        });
        return;
      }

      // Deterministic fallback only for generate_outro mode (not on quota)
      if (!parsedData.scriptText) {
        parsedData = createDeterministicVoiceScript(userText, dialect, validVoice);
      }

      textForTts = stripStageDirectionsServer(
        parsedData.phoneticText || parsedData.scriptText || userText
      );
    } else {
      // LITERAL mode (default): use the user's exact text. Do NOT rewrite, summarize, or call createDeterministicVoiceScript.
      const cleaned = stripStageDirectionsServer(userText);
      parsedData = {
        scriptText: cleaned,
        phoneticText: cleaned,
        catchyTitle: 'قراءة مباشرة للنص',
        deliveryStyle: `نطق حرفي بالدارجة ${dialectLabel}`,
        callToAction: '—',
        durationEstimate: estimateDurationFromText(cleaned),
      };
      textForTts = cleaned;
    }

    // Prevent empty or stage-direction-only text from reaching Gemini TTS.
    if (typeof textForTts !== 'string' || !textForTts.trim()) {
      res.status(400).json({
        error: 'النص فارغ بعد إزالة تعليمات الأداء. أدخل نصًا واضحًا ليتم تحويله إلى صوت.',
        code: 'EMPTY_TTS_TEXT',
        mode: generationMode,
      });
      return;
    }

    // Build performance style SEPARATELY from spoken text (never spoken aloud)
    const speechStyle = buildServerSpeechStyle(
      deliverySettings.emotionId,
      dialectLabel,
      dialectRule,
      deliverySettings,
      generationMode
    );

    // Step 2: Gemini TTS — do not cascade models on 429
    let audioDataUrl = '';
    const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let lastTtsError: string | null = null;

    for (const ttsModel of ttsModels) {
      if (quotaExceeded) break;
      try {
        const ttsResponse = await ai.models.generateContent({
          model: ttsModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: textForTts,
                  speechMetadata: {
                    style: speechStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: validVoice },
              },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          audioDataUrl = `data:audio/wav;base64,${base64Audio}`;
          break;
        }
      } catch (ttsErr: unknown) {
        lastTtsError = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        console.warn(`TTS model ${ttsModel} failed:`, lastTtsError);
        if (isQuotaOrRateLimitError(lastTtsError)) {
          quotaExceeded = true;
          break;
        }
      }
    }

    if (quotaExceeded) {
      res.status(429).json({
        error: 'انتهت حصة الاستخدام (Quota) أو تم تجاوز حد الطلبات من Google. يرجى الانتظار ثم المحاولة لاحقاً. لم يتم التحويل إلى نموذج آخر تلقائياً.',
        code: 'QUOTA_EXCEEDED',
        details: lastTtsError,
        mode: generationMode,
      });
      return;
    }

    // On TTS failure: return a real error. Never return synthetic silence as successful speech.
    if (!audioDataUrl) {
      res.status(502).json({
        error: 'فشل توليد الصوت عبر محرك TTS. لم يتم إرجاع بيانات صوتية صالحة.',
        details: lastTtsError || 'No audio data returned by any TTS model',
        mode: generationMode,
      });
      return;
    }

    const emotionLabelAr = emotionLabelFromId(deliverySettings.emotionId);

    res.json({
      success: true,
      id: 'voice-' + Date.now(),
      mode: generationMode,
      catchyTitle: parsedData.catchyTitle || (generationMode === 'literal' ? 'قراءة مباشرة للنص' : 'خاتمة جزائرية مخصصة'),
      scriptText: parsedData.scriptText || textForTts,
      phoneticText: parsedData.phoneticText || parsedData.scriptText || textForTts,
      dialect,
      dialectLabel,
      voice: validVoice,
      deliveryStyle: speechStyle.slice(0, 180),
      callToAction: parsedData.callToAction || 'التفاعل والمتابعة',
      durationEstimate: parsedData.durationEstimate || '15 ثانية',
      audioDataUrl,
      textSentToTts: textForTts,
      deliverySettings,
      emotionLabel: emotionLabelAr,
      timestamp: Date.now(),
    });
  } catch (err: unknown) {
    console.error('Error in generate-voice-script pipeline:', err);
    res.status(500).json({
      error: 'Failed to generate voice script and audio',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Endpoint: Generate Algerian Outro Voiceover / Speech
// Uses gemini-3.8-flash-lite-tts or gemini-3.8-flash-tts
app.post('/api/generate-speech', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, voiceName = 'Zephyr', speechStyle } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({
        error: 'Text is required and must contain spoken words',
        code: 'EMPTY_TTS_TEXT',
      });
      return;
    }
    const normalizedText = text.trim();

    const validVoice = ['Kore', 'Puck', 'Fenrir', 'Zephyr', 'Charon'].includes(voiceName) ? voiceName : 'Zephyr';

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: normalizedText,
              speechMetadata: {
                style: speechStyle || 'Natural, warm, engaging Algerian dialect and tone with friendly outro energy',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: validVoice },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(500).json({ error: 'Audio data was not returned by TTS model' });
      return;
    }

    const audioDataUrl = `data:audio/wav;base64,${base64Audio}`;
    res.json({ success: true, audioDataUrl, voice: validVoice });
  } catch (err: unknown) {
    console.error('Error generating speech:', err);
    res.status(500).json({
      error: 'Failed to generate speech audio',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Endpoint: Multi-Turn Gemini Chatbot
// Supports gemini-3.8-flash (General), gemini-4-argon (Complex Tasks), gemini-3.1-flash-lite (Fast Tasks)
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, model = 'gemini-3.8-flash', roleType = 'email_marketer' } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    let systemInstruction = '';
    switch (roleType) {
      case 'algerian_voice_coach':
        systemInstruction = `أنت خبير محترف ومستشار أول في صناعة المحتوى الجزائري وهندسة الصوت والخواتم (Video Outros).
مهمتك:
1. تقديم أفضل العبارات والسيناريوهات بالدارجة الجزائرية لختام الفيديوهات (الريلز، تيك توك، يوتيوب، وبودكاست).
2. التفريق بدقة بين اللهجات الجزائرية: العاصمية الحنينة، الوهرانية الحماسية، الشرقية القسنطينية الرزينة، والتسويقية للشركات.
3. تقديم نصائح إلقاء محددة (نبرة الصوت، التوقف، الإيقاع، وإضافة الـ Call-to-Action).
4. الرد بلغة ودية وعميقة بالدارجة الجزائرية المفهومة مع صياغة واضحة وجميلة.`;
        break;
      case 'creative_director':
        systemInstruction = `You are a world-class Creative Director and Visual Prompt Specialist.
You help marketers design stunning visual identities, aesthetic email hero banners, and high-converting graphic layouts.
When given ideas, you construct hyper-detailed image prompts tailored for 1K, 2K, and 4K generation, specifying lighting, aspect ratios, composition, and color theory.`;
        break;
      case 'email_marketer':
      default:
        systemInstruction = `You are a Senior Email Marketing Strategist & Conversion Copywriting Director.
You help marketers create multi-million dollar email funnels, improve deliverability, eliminate spam triggers, maximize open rates with psychology-driven subject lines, and optimize click-through rates.
Provide clear, structured, actionable advice with concrete examples and copy revisions.`;
        break;
    }

    // Map conversation messages to Gemini format
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Choose target model safely
    const targetModel = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'].includes(model)
      ? model
      : 'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'I could not generate a response. Please try again.';
    res.json({ reply, model: targetModel, roleType });
  } catch (err: unknown) {
    console.error('Error in chat endpoint:', err);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Helper: Generates a sleek, high-fidelity SVG banner fallback
function generateFallbackSvgBanner(prompt: string, style: string, size: string): string {
  const cleanPrompt = prompt.replace(/[<>&"]/g, ' ').slice(0, 75);
  const cleanStyle = style.replace(/[<>&"]/g, ' ').slice(0, 30);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="100%" height="100%">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="50%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6366f1" />
        <stop offset="50%" stop-color="#a855f7" />
        <stop offset="100%" stop-color="#ec4899" />
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    
    <!-- Background Canvas -->
    <rect width="1200" height="630" fill="url(#bg)" />
    
    <!-- Ambient glowing accents -->
    <circle cx="200" cy="150" r="260" fill="url(#glow)" filter="blur(40px)" />
    <circle cx="1000" cy="480" r="320" fill="url(#glow)" filter="blur(60px)" />
    
    <!-- Modern Tech Grid Lines -->
    <path d="M 0,200 L 1200,200 M 0,400 L 1200,400 M 300,0 L 300,630 M 900,0 L 900,630" stroke="#334155" stroke-opacity="0.25" stroke-width="1.5" stroke-dasharray="6,6" />

    <!-- Central Floating Card -->
    <rect x="120" y="90" width="960" height="450" rx="24" fill="#0b0f19" fill-opacity="0.85" stroke="url(#accent)" stroke-width="2.5" filter="url(#shadow)" />
    
    <!-- Top Bar with Badge -->
    <rect x="160" y="130" width="160" height="36" rx="18" fill="url(#accent)" fill-opacity="0.2" stroke="#6366f1" stroke-width="1" />
    <text x="240" y="153" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#c7d2fe" text-anchor="middle" letter-spacing="1">
      STUDIO VISUAL • ${size}
    </text>

    <!-- Style Pill -->
    <rect x="880" y="130" width="160" height="36" rx="18" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="960" y="153" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#94a3b8" text-anchor="middle">
      ${cleanStyle}
    </text>

    <!-- Main Title / Hook -->
    <text x="600" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">
      Visual Marketing Campaign Asset
    </text>

    <!-- Description prompt excerpt -->
    <text x="600" y="330" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="400" fill="#cbd5e1" text-anchor="middle">
      "${cleanPrompt}..."
    </text>

    <!-- Interactive Visual Accent Elements -->
    <g transform="translate(420, 390)">
      <rect x="0" y="0" width="360" height="64" rx="32" fill="url(#accent)" />
      <text x="180" y="39" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">
        High-Conversion Visual Hero
      </text>
    </g>

    <!-- Corner Decorative Accents -->
    <circle cx="160" cy="490" r="6" fill="#10b981" />
    <text x="180" y="495" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#10b981">
      Ultra-HD Optimized
    </text>

    <text x="1040" y="495" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#64748b" text-anchor="end">
      CampaignForge Visual Studio
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Rough duration estimate from text length (Darija speaking rate ~2.3 words/sec). Used only for metadata. */
function estimateDurationFromText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(3, Math.round(words / 2.3));
  return `${seconds} ثانية تقريباً`;
}

/** Detect Google quota / rate-limit errors (HTTP 429 family). */
function isQuotaOrRateLimitError(message: string): boolean {
  const m = (message || '').toLowerCase();
  return (
    m.includes('429') ||
    m.includes('resource_exhausted') ||
    m.includes('quota') ||
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('too many requests')
  );
}

/** Strip stage directions so they are never spoken by TTS. */
function stripStageDirectionsServer(text: string): string {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
  cleaned = cleaned.replace(/【[^】]*】/g, ' ');
  cleaned = cleaned.replace(/（[^）]*）/g, ' ');
  cleaned = cleaned.replace(
    /(?:^|\n)\s*(?:بصوت|بنبرة|بأداء|style\s*:|direction\s*:|note\s*:)[^\n]*/gi,
    ' '
  );
  cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

const SERVER_EMOTION_STYLES: Record<string, { ar: string; instruction: string }> = {
  very_enthusiastic: {
    ar: 'حماسي جداً',
    instruction:
      'Very high energy, excited, upbeat delivery. Bright tone, dynamic pitch, strong momentum for product launch hype.',
  },
  product_admiration: {
    ar: 'إعجاب بالمنتج',
    instruction:
      'Warm genuine admiration for the product. Slightly slower on key benefits, sincere and inviting.',
  },
  luxurious_elegant: {
    ar: 'فخم وراقٍ',
    instruction:
      'Elegant, refined, premium delivery. Controlled pace, smooth articulation, sophisticated calm authority.',
  },
  friendly_advice: {
    ar: 'صديقة تنصح صديقتها',
    instruction:
      'Like a close friend giving warm honest advice. Conversational, intimate, caring, trustworthy.',
  },
  confident_persuasive: {
    ar: 'واثق ومقنع',
    instruction:
      'Confident, assertive, persuasive sales delivery. Clear emphasis on benefits and CTA. Decisive, not aggressive.',
  },
  playful: {
    ar: 'مرح',
    instruction:
      'Playful, light-hearted, smiling energy. Fun rhythm, youthful without being childish.',
  },
  surprise: {
    ar: 'مفاجأة',
    instruction:
      'Build mild curiosity then reveal with pleasant surprise. Slight pause before key reveal.',
  },
  calm_reassuring: {
    ar: 'هادئ ومطمئن',
    instruction:
      'Calm, steady, reassuring. Soft dynamics, even pace, comforting and trustworthy.',
  },
  emotional: {
    ar: 'عاطفي',
    instruction:
      'Emotionally expressive, heartfelt. Warmth and sincerity, gentle emphasis on emotional words.',
  },
  gradual_story: {
    ar: 'قصة بمشاعر متدرجة',
    instruction:
      'Narrative arc: start neutral/curious, gradually increase warmth, finish with clear emotional resolution.',
  },
};

function emotionLabelFromId(id: string): string {
  return SERVER_EMOTION_STYLES[id]?.ar || 'واثق ومقنع';
}

function buildServerSpeechStyle(
  emotionId: string,
  dialectLabel: string,
  dialectRule: string,
  settings: { intensity: number; pace: number; pauses: boolean },
  generationMode: string
): string {
  const emo = SERVER_EMOTION_STYLES[emotionId] || SERVER_EMOTION_STYLES.confident_persuasive;
  const intensityHint =
    settings.intensity >= 75
      ? 'High emotional intensity.'
      : settings.intensity <= 30
        ? 'Low, restrained intensity.'
        : 'Moderate natural intensity.';
  const paceHint =
    settings.pace >= 1.15
      ? 'Slightly faster speaking rate.'
      : settings.pace <= 0.9
        ? 'Slightly slower, deliberate speaking rate.'
        : 'Natural conversational speaking rate.';
  const pauseHint = settings.pauses
    ? 'Use natural short pauses between phrases for clarity.'
    : 'Keep a continuous flow with minimal pauses.';
  const modeHint =
    generationMode === 'literal'
      ? 'Speak the following text exactly as written. Do not add, remove, or change any words.'
      : 'Deliver as a natural video outro / product ad in Algerian Darija.';

  return [
    `Algerian Darija dialect: ${dialectLabel}.`,
    dialectRule,
    `Performance style: ${emo.instruction}`,
    intensityHint,
    paceHint,
    pauseHint,
    modeHint,
    'Speak ONLY the provided script text. Never read stage directions, brackets, or director notes aloud.',
  ].join(' ');
}

// Generates a valid, rich 24kHz 16-bit mono WAV file as fallback when external TTS is unavailable
// Note: intentionally NOT used as a success response for speech in /api/generate-voice-script.
function createSynthesizedWav(durationSeconds = 4, freq = 440): string {
  const sampleRate = 24000;
  const numSamples = sampleRate * durationSeconds;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // 44-byte RIFF WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Synthesize a warm melodic outro chime pattern
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - (t % 1.2) / 1.2) * Math.min(1, (durationSeconds - t) / 0.5);
    const chord =
      Math.sin(2 * Math.PI * 523.25 * t) * 0.4 + // C5
      Math.sin(2 * Math.PI * 659.25 * t) * 0.3 + // E5
      Math.sin(2 * Math.PI * 783.99 * t) * 0.3;  // G5
    const sample = Math.floor(chord * envelope * 20000);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + i * 2);
  }

  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

// Generates an authentic regional Algerian Darija script deterministically
function createDeterministicVoiceScript(prompt: string, dialect: string, voice: string) {
  const cleanPrompt = prompt.slice(0, 80);

  if (dialect === 'algiers' || dialect.includes('العاصمي')) {
    return {
      catchyTitle: 'خاتمة عاصمية ودية',
      scriptText: `يعطيكم الصحة على المشاهدة خاوتي وخواتاتي! إلا عجبكم محتوى ${cleanPrompt}، ما تنساوش ديرو جيم، تبارطاجيوه مع أصحابكم، وتشتركوا فالقناة باش يوصلكم ديما الجديد. نتلاقاو فالعدد الجاي إن شاء الله، وتهلاو بزاف في رواحتكم.. سلام!`,
      phoneticText: `يَعْطِيكُم الصَّحَّة عَلَى المُشَاهَدَة خَاوْتِي وَخْوَاتَاتِي! لَا عْجَبْكُم المُحْتَوَى، مَا تَنْسَاوْش دِيرُو جِيمْ، تْبَارْطَاجِيُوه، وَتْشْتَرْكُو ف القَنَاة بَاشْ يُوصَلْكُم دِيمَا الجْدِيدْ. نْتْلَاقَاوْ ف العَدَدْ الجَايْ إِنْ شَاءَ الله، وَتَهْلَاوْ بْزَّافْ ف رْوَاحْكُم.. سَلَامْ!`,
      deliveryStyle: 'نبرة عاصمية دافئة، ناعمة وخفيفة وقريبة من القلب',
      callToAction: 'الاشتراك، الإعجاب ومشاركة الفيديو',
      durationEstimate: '15 ثانية',
    };
  }

  if (dialect === 'western' || dialect.includes('وهران') || dialect.includes('الغربي')) {
    return {
      catchyTitle: 'خاتمة وهرانية حماسية',
      scriptText: `حبابنا وخاوتنا الزينين، يعطيكم ألف صحة على المتابعة والوفاء! فجروا لنا هذاك زر اللايك، وخلولنا رايكم فالكومنتار من تحت راه يهمنا بزااف. بارطاجيو الفيديو مع صحابكم، وتهلاولي في رواحكم وبسلامة!`,
      phoneticText: `حْبَابْنَا وَخَاوْتْنَا الزِّينِين، يَعْطِيكُم أَلْفْ صَحَّة عَلَى المُتَابَعَة وَالوِفَا! فَجَّرُولْنَا هَدَاك زْرْ اللَّايْكْ، وَخَلُّولْنَا رَايْكُم ف الكُومْنْتَارْ رَاهْ يْهِمْنَا بْزَّافْ. بَارْطَاجِيُو مْعَ صْحَابْكُم، وَتَهْلَاوْلِي ف رْوَاحْكُم وَبْسْلَامَة!`,
      deliveryStyle: 'نبرة وهرانية مفعمة بالطاقة العالية والحماس الشبابي',
      callToAction: 'تفعيل زر اللايك، التعليق والمشاركة الفورية',
      durationEstimate: '14 ثانية',
    };
  }

  if (dialect === 'eastern' || dialect.includes('قسنطين') || dialect.includes('الشرقي')) {
    return {
      catchyTitle: 'خاتمة شرقية رزينة وأصيلة',
      scriptText: `نشكركم جزيل الشكر على حسن الإصغاء وطيب المتابعة لموضوع ${cleanPrompt}. نسعد دائماً بآرائكم واقتراحاتكم في التعليقات، دمتم في رعاية الله وحفظه، والى لقاء قريب يجمعنا على الخير والبركة إن شاء الله.`,
      phoneticText: `نَشْكُرُكُم جَزِيلَ الشُّكْرِ عَلَى حُسْنِ الإِصْغَاءِ وَطِيبِ المُتَابَعَة. نَسْعَدُ دَائِمًا بِآرَائِكُم وَاقْتِرَاحَاتِكُم فِي التَّعْلِيقَات. دُمْتُم فِي رِعَايَةِ اللهِ وَحِفْظِهِ، وَإِلَى لِقَاءٍ قَرِيبٍ يَجْمَعُنَا عَلَى الخَيْرِ إِنْ شَاءَ الله.`,
      deliveryStyle: 'نبرة شرقية فخمة ورزينة، إلقاء هادئ ومحترم',
      callToAction: 'كتابة الرأي بالتعليقات والاشتراك للمتابعة',
      durationEstimate: '16 ثانية',
    };
  }

  if (dialect === 'sahara' || dialect.includes('صحراوي') || dialect.includes('تراثي')) {
    return {
      catchyTitle: 'خاتمة صحراوية وتراثية شعبية',
      scriptText: `عاش من شافكم وسمع صوتكم، ربي يحفظ بلادنا وولادنا، ويلاقينا ديماً في ساعة الخير والهنا. ما تبخلوش علينا بالاشتراك وتفعيل الجرس، بقاو على خير، وتباتوا في أمان ربي إن شاء الله.`,
      phoneticText: `عَاشْ مَنْ شَافْكُم وَسْمَعْ صُوتْكُم، رَبِّي يَحْفَظْ بْلَادْنَا وَوْلَادْنَا، وَيْلَاقِينَا دِيمًا ف سَاعَة الخَيْرْ وَالهْنَا. مَا تَبْخْلُوشْ عَلِينَا بِالاشْتِرَاك، بْقَاوْ عَلَى خَيْر، وَتْبَاتُو ف أَمَانْ رَبِّي إِنْ شَاءَ الله.`,
      deliveryStyle: 'نبرة تراثية حكيمة، دعاء وبركة وأصالة جزائرية كرمية',
      callToAction: 'الاشتراك والدعاء الطيب',
      durationEstimate: '18 ثانية',
    };
  }

  // General Algerian Darija
  return {
    catchyTitle: 'خاتمة بالدارجة الجزائرية العامة',
    scriptText: `يعطيكم ألف صحة على المشاهدة! إذا عجبكم الفيديو الخاص بـ ${cleanPrompt}، ما تنساوش تشتركوا في القناة وتضغطوا على زر اللايك. خلولنا تعليق برأيكم وبارطاجيو الفيديو مع خاوتكم. نشوفكم في العدد القادم وتهلاو في رواحكم!`,
    phoneticText: `يَعْطِيكُم أَلْفْ صَحَّة عَلَى المُشَاهَدَة! إِذَا عْجَبْكُم الڤِيدْيُو، مَا تَنْسَاوْش تَشْتَرْكُوا فِي القَنَاة وَتَضْغَطُوا عَلَى زْرْ اللَّايْكْ. خَلُّولْنَا تَعْلِيقْ بْرَايْكُم وَبَارْطَاجِيُو. نْشُوفُوكُم ف العَدَدْ القَادِمْ وَتَهْلَاوْ ف رْوَاحْكُم!`,
    deliveryStyle: 'نبرة تفاعلية عامة واضحة ومناسبة لجميع ولايات الوطن',
    callToAction: 'الاشتراك، اللايك والتعليق',
    durationEstimate: '15 ثانية',
  };
}

// Fallback deterministic campaign
function createDeterministicCampaign(prompt: string, tone?: string, audience?: string, goal?: string) {
  const title = prompt.slice(0, 35) || 'Exclusive Launch Campaign';
  return {
    name: title,
    targetAudience: audience || 'Growth marketers, founders, and decision makers',
    tone: tone || 'Persuasive, authoritative, inspiring',
    campaignGoal: goal || 'Drive immediate action and early signups',
    preheader: 'Unlock your 30% founder privilege before public launch.',
    subjectLines: [
      {
        text: `🚀 Finally: The smarter way to scale ${prompt.slice(0, 25)}`,
        openRateScore: 56,
        angle: 'Curiosity + High Status Value',
        preheader: 'Unlock your 30% founder advantage before public tier ends.',
      },
      {
        text: `Why top performers are switching to this method...`,
        openRateScore: 51,
        angle: 'Pain-Point Interrupt',
        preheader: 'See the automated workflow generating 3.4x higher conversion.',
      },
      {
        text: `Special Announcement: Your exclusive early access`,
        openRateScore: 44,
        angle: 'Direct VIP Access',
        preheader: 'Reserved access for forward-thinking marketers.',
      },
    ],
    body: {
      headline: `Experience the breakthrough advantage of ${prompt.slice(0, 30)}`,
      subheadline: 'Engineered for speed, conversion, and effortless execution.',
      heroGreeting: 'Hey {{first_name|there}},',
      mainStory: `Scaling your creative output shouldn't feel like an uphill battle.

With this new solution, you eliminate tedious guesswork and move straight to high-impact results. Whether launching a new offer or building high-retention audience relationships, you get complete control.`,
      bulletPoints: [
        {
          title: 'Immediate High Conversion',
          desc: 'Optimized touchpoints crafted to drive clicks and decisive checkouts.',
        },
        {
          title: 'Studio-Grade Visuals',
          desc: 'Ultra-HD graphics crafted to command attention across all inbox devices.',
        },
        {
          title: 'Algorithmic Nurture',
          desc: 'Systematic sequences designed to educate, convince, and convert seamlessly.',
        },
      ],
      socialProof: {
        quote: 'This tool cut our production time by 80% while boosting overall conversion.',
        author: 'Nadia Benali',
        role: 'VP of Growth',
      },
      cta: {
        text: 'Claim Your Special Access',
        url: 'https://example.com/access',
        secondaryText: 'Risk-free guarantee. No setup friction.',
      },
      urgencyBanner: 'Early Access Tier: Limited spots remaining.',
      signoff: 'Best regards,',
      senderName: 'The CampaignForge Innovation Team',
      companyName: 'CampaignForge AI',
      companyAddress: 'Hydra Innovation Hub, Algiers',
    },
    visual: {
      prompt: `A modern futuristic visual hero banner for ${prompt}`,
      style: 'Cinematic 3D Modern',
    },
    dripSequence: [
      {
        step: 1,
        title: 'The Announcement',
        sendDelay: 'Day 0 (Immediate)',
        subject: `Welcome to ${prompt.slice(0, 20)}: Your VIP pass`,
        summary: 'Introduce the core problem, unveil the breakthrough solution, and offer immediate privilege.',
        keyAction: 'Click to claim founder tier',
      },
      {
        step: 2,
        title: 'The Proof & Case Study',
        sendDelay: 'Day 2 (+48h)',
        subject: 'How our early members transformed their workflow',
        summary: 'Walk through concrete numbers and overcome common objections.',
        keyAction: 'Explore demo',
      },
      {
        step: 3,
        title: 'Final Urgency Call',
        sendDelay: 'Day 4 (+96h)',
        subject: '⚠️ Final Hours: Tier privileges are expiring',
        summary: 'Direct reminder of deadlines and final checkout link.',
        keyAction: 'Final action',
      },
    ],
  };
}

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampaignForge Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
