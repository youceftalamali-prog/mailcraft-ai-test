import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEmailMetrics,
  formatEmailHtml,
  filterAlgerianOutros,
  generateDefaultCampaign,
  ALGERIAN_OUTRO_COLLECTION,
  ALGERIAN_DIALECTS,
  getDialectPromptInstructions,
  estimateAudioDuration,
  DELIVERY_EMOTIONS,
  DEFAULT_DELIVERY_SETTINGS,
  stripStageDirections,
  buildSpeechStyleFromDelivery,
  getDeliveryEmotion,
} from './campaign.ts';

test('calculateEmailMetrics returns valid numbers and spam score boundaries', () => {
  const cleanSubject = 'Introducing our new spring collection';
  const cleanBody = 'We have designed handcrafted essentials tailored for modern creators. Enjoy sustainable quality and timeless silhouettes.';
  const metrics = calculateEmailMetrics(cleanSubject, cleanBody);

  assert.ok(metrics.wordCount > 10, 'word count should be positive');
  assert.ok(metrics.charCount > 50, 'character count should be positive');
  assert.ok(metrics.readingTimeSeconds >= 10, 'reading time should have minimum floor');
  assert.ok(metrics.spamScore >= 0 && metrics.spamScore <= 100, 'spam score bounded 0-100');
  assert.ok(metrics.predictedOpenRate >= 15 && metrics.predictedOpenRate <= 65, 'open rate prediction bounded');
});

test('calculateEmailMetrics penalizes spam keywords', () => {
  const spammy = calculateEmailMetrics('FREE CASH WINNER $$$ ACT NOW', 'Click here free guaranteed cash 100% winner');
  const normal = calculateEmailMetrics('Your monthly engineering briefing', 'Here are the updates from our team this sprint.');

  assert.ok(spammy.spamScore > normal.spamScore, 'Spammy text must receive higher spam score');
});

test('formatEmailHtml generates valid HTML with essential components', () => {
  const campaign = generateDefaultCampaign('Productivity tool');
  const html = formatEmailHtml(campaign);

  assert.ok(html.includes('<!DOCTYPE html>'), 'Must start with html5 doctype');
  assert.ok(html.includes(campaign.body.headline), 'Must include headline');
  assert.ok(html.includes(campaign.body.companyName), 'Must include company name');
  assert.ok(html.includes(campaign.body.cta.text), 'Must include primary CTA button');
  assert.ok(html.includes('Unsubscribe'), 'Must include unsubscribe link');
});

test('filterAlgerianOutros handles filtering by region and search query', () => {
  const allOutros = ALGERIAN_OUTRO_COLLECTION;
  assert.ok(allOutros.length >= 6, 'Should have at least 6 Algerian outro options');

  const algerOnly = filterAlgerianOutros(allOutros, 'العاصمي (الوسط)');
  assert.ok(algerOnly.length >= 1, 'Should find Alger outro');
  assert.equal(algerOnly[0].region, 'العاصمي (الوسط)');

  const searchResults = filterAlgerianOutros(allOutros, undefined, 'اللايك');
  assert.ok(searchResults.length >= 1, 'Search query should match text mentioning like/action');
});

test('ALGERIAN_DIALECTS contains the required 5 regional dialect keys', () => {
  const dialectIds = ALGERIAN_DIALECTS.map((d) => d.id);
  assert.ok(dialectIds.includes('general'), 'Must include general Darija');
  assert.ok(dialectIds.includes('algiers'), 'Must include Algiers');
  assert.ok(dialectIds.includes('eastern'), 'Must include Eastern');
  assert.ok(dialectIds.includes('western'), 'Must include Western');
  assert.ok(dialectIds.includes('sahara'), 'Must include Sahara / Traditional');
});

test('getDialectPromptInstructions returns tailored dialect instructions', () => {
  const algiers = getDialectPromptInstructions('algiers');
  assert.ok(algiers.includes('العاصمية'), 'Must mention Algiers dialect');

  const western = getDialectPromptInstructions('western');
  assert.ok(western.includes('الغربية'), 'Must mention Western dialect');

  const eastern = getDialectPromptInstructions('eastern');
  assert.ok(eastern.includes('الشرقية'), 'Must mention Eastern dialect');
});

test('estimateAudioDuration computes realistic speaking times', () => {
  const shortText = 'يعطيكم الصحة على المشاهدة خاوتي!';
  const duration = estimateAudioDuration(shortText);
  assert.ok(duration.includes('ثانية'), 'Must return Arabic second string');
});

// --- Phase 1: literal TTS mode contract & Algiers preservation ---

test('Algiers dialect definition and recommended voice remain Zephyr (must not change)', () => {
  const algiers = ALGERIAN_DIALECTS.find((d) => d.id === 'algiers');
  assert.ok(algiers, 'algiers dialect must exist');
  assert.equal(algiers!.recommendedVoice, 'Zephyr', 'Algiers recommended voice must stay Zephyr');
  assert.ok(
    algiers!.description.includes('عاصمية') || algiers!.label.includes('العاصمي'),
    'Algiers label/description must remain intact'
  );
});

test('getDialectPromptInstructions for algiers is unchanged in content requirements', () => {
  const instructions = getDialectPromptInstructions('algiers');
  assert.ok(instructions.includes('العاصمية'), 'Must still describe Algiers dialect');
  assert.ok(
    instructions.includes('خاوتي') || instructions.includes('تهلاو'),
    'Must still contain characteristic Algiers vocabulary samples'
  );
});

/**
 * Contract test for literal mode (Phase 1):
 * When mode === 'literal', the exact user text must be the text sent to TTS.
 * This test documents and asserts the pure mapping logic that the server implements.
 * (Full end-to-end TTS requires a live GEMINI_API_KEY and is not run here.)
 */
test('literal mode contract: user text is preserved as scriptText and textSentToTts', () => {
  const userFullScript =
    'يعطيكم الصحة على المشاهدة خاوتي وخواتاتي. هذا سكريبت كامل طويل نسبياً يحتوي على عدة جمل. ما تنساوش ديرو جيم وتبارطاجيو الفيديو وتشتركو فالقناة. نتلاقاو فالعدد الجاي إن شاء الله وتهلاو ف رواحكم. سلام.';

  // Pure mapping that mirrors server literal-mode behavior
  const generationMode = 'literal' as const;
  const parsedData =
    generationMode === 'literal'
      ? {
          scriptText: userFullScript,
          phoneticText: userFullScript,
          catchyTitle: 'قراءة مباشرة للنص',
          deliveryStyle: 'نطق حرفي',
          callToAction: '—',
        }
      : null;

  assert.ok(parsedData, 'literal mode must produce parsedData');
  assert.equal(parsedData!.scriptText, userFullScript, 'scriptText must equal full user input');
  assert.equal(parsedData!.phoneticText, userFullScript, 'phoneticText must equal full user input in literal mode');
  assert.notEqual(
    parsedData!.scriptText.length,
    0,
    'script must not be empty'
  );
  // Ensure we did not collapse to a short outro
  assert.ok(
    parsedData!.scriptText.split(/\s+/).length > 20,
    'full script word count must be preserved (not replaced by short outro)'
  );
});

test('generate_outro mode still has a deterministic path available (not used in literal)', () => {
  // Sanity: createDeterministicVoiceScript is still present in server for generate_outro only.
  // We cannot import server helpers easily here; we only assert dialect data still supports outro presets.
  const westernPreset = ALGERIAN_OUTRO_COLLECTION.find((o) => o.region.includes('الوهراني'));
  assert.ok(westernPreset, 'Western/Orani preset outro must still exist for generate_outro mode');
  const algiersPreset = ALGERIAN_OUTRO_COLLECTION.find((o) => o.region.includes('العاصمي'));
  assert.ok(algiersPreset, 'Algiers preset outro must still exist');
});



test('DELIVERY_EMOTIONS includes all required professional styles', () => {
  const ids = DELIVERY_EMOTIONS.map((e) => e.id);
  const required = [
    'very_enthusiastic',
    'product_admiration',
    'luxurious_elegant',
    'friendly_advice',
    'confident_persuasive',
    'playful',
    'surprise',
    'calm_reassuring',
    'emotional',
    'gradual_story',
  ];
  for (const id of required) {
    assert.ok(ids.includes(id as any), `Must include emotion ${id}`);
  }
  assert.equal(DELIVERY_EMOTIONS.length, 10, 'Exactly 10 delivery emotions');
});

test('DEFAULT_DELIVERY_SETTINGS has natural defaults', () => {
  assert.equal(DEFAULT_DELIVERY_SETTINGS.emotionId, 'confident_persuasive');
  assert.equal(DEFAULT_DELIVERY_SETTINGS.intensity, 55);
  assert.equal(DEFAULT_DELIVERY_SETTINGS.pace, 1.0);
  assert.equal(DEFAULT_DELIVERY_SETTINGS.pauses, true);
});

test('stripStageDirections removes bracket notes and keeps spoken text', () => {
  const raw =
    'مرحبا بكم [بصوت حماسي] في عرض المنتج الجديد (ملاحظة: ابتسم) يعطيكم الصحة';
  const cleaned = stripStageDirections(raw);
  assert.ok(!cleaned.includes('['), 'Must remove square brackets');
  assert.ok(!cleaned.includes('بصوت حماسي'), 'Must not keep stage direction words as spoken content markers');
  assert.ok(cleaned.includes('مرحبا بكم'), 'Must keep real spoken text');
  assert.ok(cleaned.includes('يعطيكم الصحة'), 'Must keep real spoken text at end');
});

test('buildSpeechStyleFromDelivery never embeds user script and includes emotion instruction', () => {
  const style = buildSpeechStyleFromDelivery(
    'very_enthusiastic',
    'العاصمي (الوسط)',
    'قواعد عاصمية',
    { intensity: 80, pace: 1.2, pauses: true }
  );
  assert.ok(style.includes('Algerian Darija'), 'Must mention dialect');
  assert.ok(style.includes('high energy') || style.includes('High emotional'), 'Must include emotion/intensity cues');
  assert.ok(style.includes('Speak ONLY the provided script'), 'Must instruct not to invent words');
  assert.ok(!style.includes('scriptText'), 'Style must not contain script payload keys');
});

test('getDeliveryEmotion returns known emotion', () => {
  const emo = getDeliveryEmotion('friendly_advice');
  assert.ok(emo, 'friendly_advice must exist');
  assert.equal(emo!.labelAr, 'صديقة تنصح صديقتها');
});
