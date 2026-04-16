import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Socket } from 'socket.io-client';
import {
  createRealtimeSocket,
  type StreamComment,
  type StreamReaction,
  type RealtimeClientEvents,
  type RealtimeEvents,
} from '../realtime/socket';
import './LiveChatPanel.css';

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function LiveChatPanel({
  streamId,
  displayName,
}: {
  streamId: string;
  displayName: string;
}) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(
    'connecting'
  );
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [reactions, setReactions] = useState<StreamReaction[]>([]);
  const [text, setText] = useState('');

  const socketRef = useRef<Socket<RealtimeEvents, RealtimeClientEvents> | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const quickReactions = useMemo(() => ['❤️', '👍', '😂', '🔥', '👏'], []);

  useEffect(() => {
    setStatus('connecting');
    setComments([]);
    setReactions([]);

    const s = createRealtimeSocket();
    socketRef.current = s;

    const onConnect = () => {
      setStatus('live');
      s.emit('stream:join', { streamId, name: displayName });
    };
    const onDisconnect = () => setStatus('offline');

    const onComment = (c: StreamComment) => {
      if (c.streamId !== streamId) return;
      setComments((prev) => [...prev, c].slice(-200));
      queueMicrotask(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    };
    const onReaction = (r: StreamReaction) => {
      if (r.streamId !== streamId) return;
      setReactions((prev) => [...prev, r].slice(-50));
      // Auto-prune reactions after a short time for a “live” feel.
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((x) => x.id !== r.id));
      }, 3500);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('stream:comment', onComment);
    s.on('stream:reaction', onReaction);

    // If already connected (hot reload), join immediately.
    if (s.connected) onConnect();

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('stream:comment', onComment);
      s.off('stream:reaction', onReaction);
      s.disconnect();
      socketRef.current = null;
    };
  }, [displayName, streamId]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    socketRef.current?.emit('stream:comment', { streamId, text: msg });
    setText('');
  };

  const react = (reaction: string) => {
    socketRef.current?.emit('stream:reaction', { streamId, reaction });
  };

  return (
    <div className="livechat glass">
      <div className="livechat-header">
        <div>
          <h3>Live comments</h3>
          <div className={`livechat-status ${status}`}>
            {status === 'live'
              ? 'Connected'
              : status === 'connecting'
                ? 'Connecting…'
                : 'Offline'}
          </div>
        </div>
        <div className="livechat-reactions">
          {quickReactions.map((r) => (
            <button
              key={r}
              type="button"
              className="reaction-btn"
              onClick={() => react(r)}
              title={`Send ${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="livechat-stage">
        {reactions.map((r) => (
          <div key={r.id} className="reaction-float">
            <span className="reaction-emoji">{r.reaction}</span>
            <span className="reaction-name">{r.name}</span>
          </div>
        ))}
      </div>

      <div className="livechat-feed" ref={scrollRef}>
        {comments.length === 0 ? (
          <div className="livechat-empty">
            No messages yet. Ask a question or say hello.
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="livechat-msg">
              <div className="meta">
                <span className="name">{c.name}</span>
                <span className="time">{formatTime(c.ts)}</span>
              </div>
              <div className="text">{c.text}</div>
            </div>
          ))
        )}
      </div>

      <form className="livechat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          maxLength={400}
        />
        <button type="submit" className="btn-primary" disabled={status !== 'live'}>
          Send
        </button>
      </form>
    </div>
  );
}

