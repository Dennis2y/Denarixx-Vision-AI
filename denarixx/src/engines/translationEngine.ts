// Sprint 13 — Translation Engine (pure functional, no async, no I/O)
// Translates UI text using a built-in phrase dictionary.
// Safety rule: critical hazard translations are always resolved synchronously
// from the dictionary — no async look-up, no external API call in Phase 1.

import type {
  SupportedLanguage,
  TranslationContext,
  TranslationInput,
  TranslationOutput,
} from '@/types/language';

// ─── Phrase dictionary ────────────────────────────────────────────────────────
// Keys are canonical English phrases. Values are per-language translations.
// Expand this dictionary to add new phrases; the engine will fall back to
// English when a key is missing in a target language.

type PhraseDictionary = Record<string, Record<SupportedLanguage, string>>;

export const PHRASE_DICTIONARY: PhraseDictionary = {
  // ── Hazard alerts ──────────────────────────────────────────────────────────
  'Hazard ahead': {
    en: 'Hazard ahead',
    de: 'Gefahr voraus',
    fr: 'Danger devant',
    es: 'Peligro adelante',
    it: 'Pericolo davanti',
    pt: 'Perigo à frente',
    ar: 'خطر أمامك',
    sw: 'Hatari mbele',
  },
  'Stop immediately': {
    en: 'Stop immediately',
    de: 'Sofort anhalten',
    fr: 'Arrêtez immédiatement',
    es: 'Deténgase inmediatamente',
    it: 'Fermarsi immediatamente',
    pt: 'Pare imediatamente',
    ar: 'توقف فوراً',
    sw: 'Simama mara moja',
  },
  'Person approaching from the left': {
    en: 'Person approaching from the left',
    de: 'Person nähert sich von links',
    fr: 'Personne approchant par la gauche',
    es: 'Persona acercándose por la izquierda',
    it: 'Persona in avvicinamento da sinistra',
    pt: 'Pessoa a aproximar-se pela esquerda',
    ar: 'شخص يقترب من اليسار',
    sw: 'Mtu anakuja kushoto',
  },
  'Person approaching from the right': {
    en: 'Person approaching from the right',
    de: 'Person nähert sich von rechts',
    fr: 'Personne approchant par la droite',
    es: 'Persona acercándose por la derecha',
    it: 'Persona in avvicinamento da destra',
    pt: 'Pessoa a aproximar-se pela direita',
    ar: 'شخص يقترب من اليمين',
    sw: 'Mtu anakuja kulia',
  },
  'Obstacle detected': {
    en: 'Obstacle detected',
    de: 'Hindernis erkannt',
    fr: 'Obstacle détecté',
    es: 'Obstáculo detectado',
    it: 'Ostacolo rilevato',
    pt: 'Obstáculo detectado',
    ar: 'تم اكتشاف عائق',
    sw: 'Kizuizi kimegunduliwa',
  },
  'Step down detected': {
    en: 'Step down detected',
    de: 'Absatz nach unten erkannt',
    fr: 'Marche vers le bas détectée',
    es: 'Escalón hacia abajo detectado',
    it: 'Gradino verso il basso rilevato',
    pt: 'Degrau para baixo detectado',
    ar: 'تم اكتشاف درج للأسفل',
    sw: 'Hatua chini imegunduliwa',
  },
  'Step up detected': {
    en: 'Step up detected',
    de: 'Absatz nach oben erkannt',
    fr: 'Marche vers le haut détectée',
    es: 'Escalón hacia arriba detectado',
    it: 'Gradino verso l\'alto rilevato',
    pt: 'Degrau para cima detectado',
    ar: 'تم اكتشاف درج للأعلى',
    sw: 'Hatua juu imegunduliwa',
  },
  'Clear path ahead': {
    en: 'Clear path ahead',
    de: 'Weg voraus frei',
    fr: 'Chemin dégagé devant',
    es: 'Camino despejado adelante',
    it: 'Percorso libero davanti',
    pt: 'Caminho livre à frente',
    ar: 'الطريق واضح أمامك',
    sw: 'Njia wazi mbele',
  },

  // ── Navigation ─────────────────────────────────────────────────────────────
  'Turn left': {
    en: 'Turn left',
    de: 'Links abbiegen',
    fr: 'Tournez à gauche',
    es: 'Gire a la izquierda',
    it: 'Gira a sinistra',
    pt: 'Vire à esquerda',
    ar: 'انعطف يساراً',
    sw: 'Geuka kushoto',
  },
  'Turn right': {
    en: 'Turn right',
    de: 'Rechts abbiegen',
    fr: 'Tournez à droite',
    es: 'Gire a la derecha',
    it: 'Gira a destra',
    pt: 'Vire à direita',
    ar: 'انعطف يميناً',
    sw: 'Geuka kulia',
  },
  'Continue straight ahead': {
    en: 'Continue straight ahead',
    de: 'Geradeaus weiterfahren',
    fr: 'Continuez tout droit',
    es: 'Continúe recto',
    it: 'Continua dritto',
    pt: 'Continue em frente',
    ar: 'استمر مباشرة',
    sw: 'Endelea moja kwa moja',
  },
  'You have arrived': {
    en: 'You have arrived',
    de: 'Sie sind angekommen',
    fr: 'Vous êtes arrivé',
    es: 'Ha llegado',
    it: 'Sei arrivato',
    pt: 'Chegou ao destino',
    ar: 'لقد وصلت',
    sw: 'Umefika',
  },
  'Recalculating route': {
    en: 'Recalculating route',
    de: 'Route wird neu berechnet',
    fr: 'Recalcul de l\'itinéraire',
    es: 'Recalculando ruta',
    it: 'Ricalcolo del percorso',
    pt: 'Recalculando rota',
    ar: 'إعادة حساب المسار',
    sw: 'Inahesabu upya njia',
  },

  // ── Scene descriptions ─────────────────────────────────────────────────────
  'Indoor scene detected': {
    en: 'Indoor scene detected',
    de: 'Innenszene erkannt',
    fr: 'Scène intérieure détectée',
    es: 'Escena interior detectada',
    it: 'Scena interna rilevata',
    pt: 'Cena interior detectada',
    ar: 'تم اكتشاف مشهد داخلي',
    sw: 'Eneo la ndani limegunduliwa',
  },
  'Outdoor scene detected': {
    en: 'Outdoor scene detected',
    de: 'Außenszene erkannt',
    fr: 'Scène extérieure détectée',
    es: 'Escena exterior detectada',
    it: 'Scena esterna rilevata',
    pt: 'Cena exterior detectada',
    ar: 'تم اكتشاف مشهد خارجي',
    sw: 'Eneo la nje limegunduliwa',
  },

  // ── Companion speech ───────────────────────────────────────────────────────
  'I am here to help you navigate safely': {
    en: 'I am here to help you navigate safely',
    de: 'Ich bin hier, um Ihnen bei der sicheren Navigation zu helfen',
    fr: 'Je suis là pour vous aider à naviguer en toute sécurité',
    es: 'Estoy aquí para ayudarle a navegar con seguridad',
    it: 'Sono qui per aiutarti a navigare in sicurezza',
    pt: 'Estou aqui para ajudá-lo a navegar com segurança',
    ar: 'أنا هنا لمساعدتك في التنقل بأمان',
    sw: 'Niko hapa kukusaidia kusogea salama',
  },
  'Session started': {
    en: 'Session started',
    de: 'Sitzung gestartet',
    fr: 'Session démarrée',
    es: 'Sesión iniciada',
    it: 'Sessione avviata',
    pt: 'Sessão iniciada',
    ar: 'بدأت الجلسة',
    sw: 'Kikao kimeanza',
  },
  'Session ended': {
    en: 'Session ended',
    de: 'Sitzung beendet',
    fr: 'Session terminée',
    es: 'Sesión finalizada',
    it: 'Sessione terminata',
    pt: 'Sessão terminada',
    ar: 'انتهت الجلسة',
    sw: 'Kikao kimekwisha',
  },

  // ── Trust & AI ─────────────────────────────────────────────────────────────
  'High confidence decision': {
    en: 'High confidence decision',
    de: 'Entscheidung mit hoher Konfidenz',
    fr: 'Décision de haute confiance',
    es: 'Decisión de alta confianza',
    it: 'Decisione ad alta fiducia',
    pt: 'Decisão de alta confiança',
    ar: 'قرار بثقة عالية',
    sw: 'Uamuzi wa kuaminika sana',
  },
  'Low confidence — please verify': {
    en: 'Low confidence — please verify',
    de: 'Geringe Konfidenz — bitte überprüfen',
    fr: 'Faible confiance — veuillez vérifier',
    es: 'Confianza baja — por favor verifique',
    it: 'Fiducia bassa — si prega di verificare',
    pt: 'Baixa confiança — por favor verifique',
    ar: 'ثقة منخفضة - يرجى التحقق',
    sw: 'Imani ya chini — tafadhali thibitisha',
  },
  'AI explanation available': {
    en: 'AI explanation available',
    de: 'KI-Erklärung verfügbar',
    fr: 'Explication IA disponible',
    es: 'Explicación de IA disponible',
    it: 'Spiegazione AI disponibile',
    pt: 'Explicação de IA disponível',
    ar: 'شرح الذكاء الاصطناعي متاح',
    sw: 'Maelezo ya AI yanapatikana',
  },

  // ── Memory ─────────────────────────────────────────────────────────────────
  'Memory saved': {
    en: 'Memory saved',
    de: 'Erinnerung gespeichert',
    fr: 'Souvenir enregistré',
    es: 'Memoria guardada',
    it: 'Memoria salvata',
    pt: 'Memória guardada',
    ar: 'تم حفظ الذاكرة',
    sw: 'Kumbukumbu imehifadhiwa',
  },
  'I remember this place': {
    en: 'I remember this place',
    de: 'Ich erinnere mich an diesen Ort',
    fr: 'Je me souviens de cet endroit',
    es: 'Recuerdo este lugar',
    it: 'Ricordo questo posto',
    pt: 'Lembro-me deste lugar',
    ar: 'أتذكر هذا المكان',
    sw: 'Nakumbuka mahali hapa',
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  'Language': {
    en: 'Language',
    de: 'Sprache',
    fr: 'Langue',
    es: 'Idioma',
    it: 'Lingua',
    pt: 'Idioma',
    ar: 'اللغة',
    sw: 'Lugha',
  },
  'Voice': {
    en: 'Voice',
    de: 'Stimme',
    fr: 'Voix',
    es: 'Voz',
    it: 'Voce',
    pt: 'Voz',
    ar: 'الصوت',
    sw: 'Sauti',
  },
  'Settings': {
    en: 'Settings',
    de: 'Einstellungen',
    fr: 'Paramètres',
    es: 'Ajustes',
    it: 'Impostazioni',
    pt: 'Configurações',
    ar: 'الإعدادات',
    sw: 'Mipangilio',
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function lookupPhrase(text: string, targetLang: SupportedLanguage): string | null {
  const entry = PHRASE_DICTIONARY[text];
  if (!entry) return null;
  return entry[targetLang] ?? entry['en'] ?? null;
}

function buildOutput(
  input: TranslationInput,
  translatedText: string,
  startMs: number,
): TranslationOutput {
  return {
    originalText: input.text,
    translatedText,
    sourceLanguage: input.sourceLanguage ?? 'en',
    targetLanguage: input.targetLanguage,
    context: input.context,
    wasSimulated: true,
    latencyMs: Date.now() - startMs,
    timestamp: Date.now(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Translates text to the target language.
 * - Checks the phrase dictionary first.
 * - Falls back to original text when no translation is found (safe fallback).
 * - Critical alerts (`isCritical: true`) are resolved from the dictionary
 *   only — never delayed for any async operation.
 */
export function translateText(input: TranslationInput): TranslationOutput {
  const start = Date.now();
  if (input.targetLanguage === (input.sourceLanguage ?? 'en')) {
    return buildOutput(input, input.text, start);
  }

  const found = lookupPhrase(input.text, input.targetLanguage);
  return buildOutput(input, found ?? input.text, start);
}

/**
 * Translates a hazard alert phrase.
 * Safety guarantee: always resolves synchronously from the dictionary.
 */
export function translateHazardAlert(
  text: string,
  targetLang: SupportedLanguage,
): TranslationOutput {
  return translateText({
    text,
    context: 'hazard',
    sourceLanguage: 'en',
    targetLanguage: targetLang,
    isCritical: true,
  });
}

/**
 * Translates a scene description.
 */
export function translateSceneDescription(
  text: string,
  targetLang: SupportedLanguage,
): TranslationOutput {
  return translateText({ text, context: 'scene', sourceLanguage: 'en', targetLanguage: targetLang });
}

/**
 * Translates a navigation instruction.
 */
export function translateNavigationGuidance(
  text: string,
  targetLang: SupportedLanguage,
): TranslationOutput {
  return translateText({ text, context: 'navigation', sourceLanguage: 'en', targetLanguage: targetLang });
}

/**
 * Translates companion speech.
 */
export function translateCompanionSpeech(
  text: string,
  targetLang: SupportedLanguage,
): TranslationOutput {
  return translateText({ text, context: 'companion', sourceLanguage: 'en', targetLanguage: targetLang });
}

/**
 * Translates AI explanation text.
 */
export function translateAIExplanation(
  text: string,
  targetLang: SupportedLanguage,
): TranslationOutput {
  return translateText({ text, context: 'ai', sourceLanguage: 'en', targetLanguage: targetLang });
}

/**
 * Translates memory summary text.
 */
export function translateMemorySummary(
  text: string,
  targetLang: SupportedLanguage,
): TranslationOutput {
  return translateText({ text, context: 'memory', sourceLanguage: 'en', targetLanguage: targetLang });
}

/**
 * Batch-translates an array of texts for the same context and target language.
 */
export function batchTranslate(
  texts: string[],
  targetLang: SupportedLanguage,
  context: TranslationContext,
): TranslationOutput[] {
  return texts.map(text =>
    translateText({ text, context, sourceLanguage: 'en', targetLanguage: targetLang }),
  );
}

/**
 * Lists all phrase keys in the dictionary.
 */
export function listPhraseKeys(): string[] {
  return Object.keys(PHRASE_DICTIONARY);
}

/**
 * Returns all translations for a given English phrase.
 */
export function getAllTranslations(phrase: string): Record<SupportedLanguage, string> | null {
  return PHRASE_DICTIONARY[phrase] ?? null;
}

/**
 * Adds a custom phrase to the dictionary (returns a new copy).
 */
export function addPhrase(
  dictionary: PhraseDictionary,
  key: string,
  translations: Record<SupportedLanguage, string>,
): PhraseDictionary {
  return { ...dictionary, [key]: translations };
}

/**
 * Formats text for RTL languages — wraps in Unicode directional markers.
 */
export function formatForRTL(text: string, isRTL: boolean): string {
  if (!isRTL) return text;
  return `\u202B${text}\u202C`; // RLE … PDF
}
