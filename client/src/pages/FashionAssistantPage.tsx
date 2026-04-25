import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FashionAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setInput('');

    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('http://localhost:5000/api/ai/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [...messages, userMsg], context: { city: 'Dhaka', season: 'summer' } }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.assistant || data.error || 'No response' };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error connecting to AI assistant.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="dash-wrap">
      <div className="dash-header"><h1>AI Fashion Assistant</h1><p className="muted">Get personalized styling advice</p></div>
      <div className="dash-card" style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '70vh' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', borderBottom: '1px solid #1f2937' }}>
          {messages.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', marginTop: '2rem' }}>Ask me anything about fashion! e.g. "What to wear for Eid dinner?"</p>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '0.75rem', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <div style={{ display: 'inline-block', padding: '0.6rem 1rem', borderRadius: '0.75rem', background: msg.role === 'user' ? 'linear-gradient(135deg, #22c55e, #0ea5e9)' : '#111827', color: 'white', maxWidth: '70%' }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {loading && <div style={{ textAlign: 'left' }}><div style={{ display: 'inline-block', padding: '0.6rem 1rem', borderRadius: '0.75rem', background: '#111827' }}>Thinking...</div></div>}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Type your question..." rows={1} style={{ flex: 1, background: '#020617', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '0.7rem', padding: '0.55rem 0.7rem', resize: 'none' }} />
          <button onClick={sendMessage} disabled={loading} className="btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
};

export default FashionAssistantPage;

