'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { SceneDescription } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface ConversationBoxProps {
  scene: SceneDescription | null;
  sessionId: string | null;
}

export function ConversationBox({ scene, sessionId }: ConversationBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ask = async () => {
    const q = input.trim();
    if (!q || !sessionId) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/conversation/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question: q, context: scene }),
      });
      const { data } = await res.json();
      setMessages((m) => [...m, { role: 'assistant', text: data.answer }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Error contacting conversation engine.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card role="region" aria-label="Conversation with Denarixx AI">
      <CardHeader>
        <CardTitle>💬 Ask Denarixx</CardTitle>
      </CardHeader>

      {!sessionId && (
        <p className="text-gray-500 text-sm mb-3">Start a session to ask questions.</p>
      )}

      <div
        className="space-y-2 max-h-40 overflow-y-auto mb-3"
        role="log"
        aria-live="polite"
        aria-label="Conversation history"
      >
        {messages.length === 0 && sessionId && (
          <p className="text-gray-500 text-xs">
            Try: &quot;What is around me?&quot; or &quot;Is it safe?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'bg-blue-900/50 text-blue-200 ml-8'
                : 'bg-gray-800 text-gray-200 mr-8'
            }`}
          >
            <span className="font-semibold text-xs block mb-0.5">
              {m.role === 'user' ? 'You' : 'Denarixx'}
            </span>
            {m.text}
          </div>
        ))}
        {isLoading && (
          <div className="text-gray-500 text-xs animate-pulse">Thinking…</div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask about your surroundings…"
          disabled={!sessionId || isLoading}
          aria-label="Ask Denarixx a question"
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
        />
        <Button
          onClick={ask}
          disabled={!sessionId || isLoading || !input.trim()}
          size="sm"
          aria-label="Send question"
        >
          Ask
        </Button>
      </div>
    </Card>
  );
}
