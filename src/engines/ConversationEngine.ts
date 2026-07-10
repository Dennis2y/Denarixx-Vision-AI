import type { IConversationEngine } from './types';
import { SAFETY_DISCLAIMER } from './types';
import type { SceneDescription } from '@/types';

// Simple rule-based conversation for Phase 1 simulation.
// Swap the resolveWithAI() path for real LLM calls in Phase 2.

const QUESTION_PATTERNS: Array<{
  pattern: RegExp;
  respond: (scene: SceneDescription | null) => string;
}> = [
  {
    pattern: /what('?s| is) (around|near|in front of) me/i,
    respond: (s) =>
      s ? `${s.summary} Confidence: ${Math.round(s.confidence * 100)}%.` : 'No scene data available yet.',
  },
  {
    pattern: /is (it|the path|the way) safe/i,
    respond: (s) =>
      s && s.confidence >= 0.75
        ? `Based on what I can see, the path appears clear. ${SAFETY_DISCLAIMER}`
        : `I'm not confident enough to confirm safety right now. ${SAFETY_DISCLAIMER}`,
  },
  {
    pattern: /describe (the room|the scene|what you see|this place)/i,
    respond: (s) =>
      s
        ? `${s.summary}${s.uncertaintyMessage ? ` ${s.uncertaintyMessage}` : ''}`
        : 'I do not have a scene description yet. Start a vision session first.',
  },
  {
    pattern: /where am i/i,
    respond: (s) =>
      s
        ? `Based on the scene: ${s.summary} I cannot determine your exact location without GPS. ${SAFETY_DISCLAIMER}`
        : 'I cannot determine your location right now.',
  },
  {
    pattern: /help/i,
    respond: () =>
      'You can ask me: what is around me, describe the scene, is it safe, where am I, guide me to the exit.',
  },
  {
    pattern: /guide me|navigate|how do i get/i,
    respond: () =>
      'Navigation guidance is in early development. I can describe your surroundings and alert you to hazards. For turn-by-turn navigation, connect a GPS source.',
  },
];

export class ConversationEngine implements IConversationEngine {
  async ask(question: string, context: SceneDescription | null): Promise<string> {
    for (const { pattern, respond } of QUESTION_PATTERNS) {
      if (pattern.test(question)) {
        return respond(context);
      }
    }

    // Fallback: if OpenAI key is present, could call real LLM here (Phase 2)
    if (context) {
      return `I heard your question. Based on the current scene: ${context.summary} I'm not sure how to answer that more specifically yet.`;
    }
    return "I'm not sure how to answer that yet. Try asking: 'what is around me?' or 'describe the scene'.";
  }
}

let _instance: ConversationEngine | null = null;

export function getConversationEngine(): ConversationEngine {
  if (!_instance) _instance = new ConversationEngine();
  return _instance;
}
