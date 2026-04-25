import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveSessions } from '../services/liveService';
import { useAuction } from '../context/AuctionContext';
import AuctionLauncher from '../components/live/AuctionLauncher';
import ActiveAuctionPanel from '../components/live/ActiveAuctionPanel';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

type LiveComment = {
  id: string;
  username: string;
  text: string;
  timestamp: number;
};

type LiveReaction = {
  id: string;
  emoji: string;
  username: string;
  ts: number;
};

const SellerLiveStudio: React.FC = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const { auction, secondsRemaining, setLiveSessionId } = useAuction();
  const [liveSessionId, setSessionId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    getActiveSessions()
      .then((sessions) => {
        const mine = (sessions || []).find((s: { sellerId?: string; _id?: string; channelName?: string; title?: string }) => s.sellerId === user.id);
        setSessionId(mine?._id || null);
        setChannelName(mine?.channelName || null);
        setStreamTitle(mine?.title || '');
        setStreamActive(Boolean(mine?._id));
      })
      .catch(() => {
        setSessionId(null);
        setChannelName(null);
        setStreamActive(false);
      });
  }, [user?.id]);

  useEffect(() => {
    setLiveSessionId(liveSessionId);
    return () => setLiveSessionId(null);
  }, [liveSessionId, setLiveSessionId]);

  // Initialize local video stream when stream becomes active
  useEffect(() => {
    if (!streamActive) {
      // Stop local stream when stream ends
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      return;
    }

    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Failed to access camera/microphone:', err);
        setLiveError('Failed to access camera or microphone. Please check permissions.');
      }
    };

    startLocalStream();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [streamActive]);

  // Handle socket events for new viewers
  useEffect(() => {
    if (!socket || !channelName) return;

    const onNewViewer = async ({ viewerSocketId }: { viewerSocketId: string }) => {
      if (!localStreamRef.current) return;
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        });

        peerConnectionsRef.current.set(viewerSocketId, pc);

        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', {
              targetSocketId: viewerSocketId,
              candidate: event.candidate,
              channelName,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            peerConnectionsRef.current.delete(viewerSocketId);
            pc.close();
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('seller-offer', {
          offer,
          targetSocketId: viewerSocketId,
          channelName,
        });
      } catch (err) {
        console.error('Failed to create peer connection for viewer:', err);
      }
    };

    const onViewerAnswer = async ({ answer, viewerSocketId }: { answer: RTCSessionDescriptionInit; viewerSocketId: string }) => {
      const pc = peerConnectionsRef.current.get(viewerSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Failed to set remote description:', err);
        }
      }
    };

    const onIceCandidate = async ({ candidate, fromSocketId }: { candidate: RTCIceCandidate; fromSocketId: string }) => {
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      }
    };

    const onViewerLeft = ({ viewerSocketId }: { viewerSocketId: string }) => {
      const pc = peerConnectionsRef.current.get(viewerSocketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(viewerSocketId);
      }
    };

    const onViewerRequestOffer = ({ viewerSocketId }: { viewerSocketId: string }) => {
      if (viewerSocketId) {
        onNewViewer({ viewerSocketId });
      }
    };

    socket.on('new-viewer', onNewViewer);
    socket.on('viewer-answer', onViewerAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('viewer-left', onViewerLeft);
    socket.on('viewer-request-offer', onViewerRequestOffer);

    return () => {
      socket.off('new-viewer', onNewViewer);
      socket.off('viewer-answer', onViewerAnswer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('viewer-left', onViewerLeft);
      socket.off('viewer-request-offer', onViewerRequestOffer);
    };
  }, [socket, channelName]);

  useEffect(() => {
    if (!socket || !channelName) return;
    const onComment = (payload: LiveComment) => {
      setComments((prev) => [...prev.slice(-49), payload]);
    };
    const onReaction = (payload: LiveReaction) => {
      setReactions((prev) => [...prev, payload]);
      setTimeout(() => {
        setReactions((prev) => prev.filter(r => r.id !== payload.id));
      }, 2000);
    };
    socket.on('new-comment', onComment);
    socket.on('new-reaction', onReaction);
    return () => {
      socket.off('new-comment', onComment);
      socket.off('new-reaction', onReaction);
    };
  }, [socket, channelName]);

  useEffect(() => {
    if (!socket || !channelName || !streamActive) return;
    socket.emit('seller-start-stream', { channelName });
  }, [socket, channelName, streamActive]);

  useEffect(() => {
    if (!channelName) {
      setComments([]);
      return;
    }
    api
      .get(`/live/${channelName}/comments`)
      .then((res) => setComments(res.data?.comments || []))
      .catch(() => setComments([]));
  }, [channelName]);

  const hasActiveAuction = useMemo(() => Boolean(auction && auction.status === 'active'), [auction]);
  const streamLink = channelName ? `${window.location.origin}/live/${channelName}` : '';

  const handleStartStream = async () => {
    if (!user?.id || !user?.name) return;
    const title = streamTitle.trim() || `${user.name}'s Live Session`;
    setIsLoading(true);
    setLiveError(null);
    try {
      const res = await api.post('/live/start', {
        sellerId: user.id,
        sellerName: user.name,
        title,
      });
      const session = res.data?.session;
      setSessionId(session?._id || null);
      setChannelName(session?.channelName || null);
      setStreamTitle(session?.title || title);
      setStreamActive(true);
      if (socket && session?.channelName) {
        socket.emit('seller-start-stream', { channelName: session.channelName });
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        || (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
        || 'Failed to start stream';
      setLiveError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndStream = async () => {
    if (!channelName) return;
    setIsLoading(true);
    setLiveError(null);
    try {
      await api.post(`/live/end/${channelName}`);
      if (socket) {
        socket.emit('seller-end-stream', { channelName });
      }
      // Close all peer connections
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      
      setStreamActive(false);
      setChannelName(null);
      setSessionId(null);
      setComments([]);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        || (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
        || 'Failed to end stream';
      setLiveError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const sendComment = () => {
    if (!socket || !channelName || !user?.name || !chatMessage.trim()) return;
    socket.emit('send-comment', {
      channelName,
      username: user.name,
      text: chatMessage.trim(),
      timestamp: Date.now(),
    });
    setChatMessage('');
  };

  const sendReaction = (emoji: string) => {
    if (!socket || !channelName || !user?.name) return;
    socket.emit('send-reaction', {
      channelName,
      emoji,
      username: user.name,
    });
  };

  const copyStreamLink = async () => {
    if (!streamLink) return;
    try {
      await navigator.clipboard.writeText(streamLink);
    } catch {
      // No-op: clipboard may not be available in insecure contexts.
    }
  };

  return (
    <div className="dash-wrap">
      <div className="live-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h1>Seller Live Studio</h1>
          <div className="live-badge"><span className="live-badge-dot" /> {streamActive ? 'LIVE' : 'OFFLINE'}</div>
        </div>
        <div className="dash-card" style={{ marginBottom: '1rem' }}>
          <label className="auth-field">
            <span>Stream title</span>
            <input
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="Give your stream a title"
              disabled={isLoading || streamActive}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!streamActive ? (
              <button className="btn-primary" type="button" onClick={handleStartStream} disabled={isLoading || !user?.id}>
                {isLoading ? 'Starting...' : 'Start Live Stream'}
              </button>
            ) : (
              <button className="btn-danger" type="button" onClick={handleEndStream} disabled={isLoading}>
                {isLoading ? 'Ending...' : 'End Stream'}
              </button>
            )}
            {streamLink && (
              <button className="btn-secondary" type="button" onClick={copyStreamLink}>
                Copy Buyer Watch Link
              </button>
            )}
          </div>
          {channelName && <p className="muted" style={{ marginTop: '0.5rem' }}>Watch URL: {streamLink}</p>}
          {liveError && <p className="auth-error" style={{ marginTop: '0.5rem' }}>{liveError}</p>}
        </div>
        <div className="live-video-container" style={{ position: 'relative' }}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            style={{ 
              width: '100%', 
              height: 400, 
              backgroundColor: '#000', 
              borderRadius: '0.5rem',
              objectFit: 'cover' 
            }} 
          />
          {reactions.length > 0 && (
            <div style={{ 
              position: 'absolute', 
              bottom: '20px', 
              left: '20px', 
              display: 'flex', 
              gap: '10px', 
              flexWrap: 'wrap' 
            }}>
              {reactions.map((r) => (
                <div 
                  key={r.id}
                  style={{ 
                    fontSize: '2rem', 
                    animation: 'float 1s ease-out forwards',
                    opacity: 0.8
                  }}
                >
                  {r.emoji}
                </div>
              ))}
            </div>
          )}
          {!streamActive && (
            <div style={{ 
              position: 'absolute', 
              inset: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: '0.5rem'
            }}>
              <div style={{ color: '#fff', textAlign: 'center' }}>
                <p>Start the stream to go live</p>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Signaling and live session are active for end-to-end seller to buyer flow.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="live-chat" style={{ marginTop: '1rem', height: 300 }}>
          <div className="live-chat-header">Live Chat</div>
          <div className="live-chat-body">
            {comments.length === 0 ? (
              <div className="chat-message">
                <div className="chat-message-author">System</div>
                <div className="chat-message-text">No comments yet.</div>
              </div>
            ) : (
              comments.map((c) => (
                <div className="chat-message" key={c.id}>
                  <div className="chat-message-author">{c.username}</div>
                  <div className="chat-message-text">{c.text}</div>
                </div>
              ))
            )}
          </div>
          <div className="live-chat-input">
            <input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Reply to viewers..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendComment();
              }}
              disabled={!streamActive}
            />
            <button className="btn-primary" type="button" onClick={sendComment} disabled={!streamActive || !chatMessage.trim()}>
              Send
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button type="button" onClick={() => sendReaction('👍')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }} disabled={!streamActive}>👍</button>
            <button type="button" onClick={() => sendReaction('❤️')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }} disabled={!streamActive}>❤️</button>
            <button type="button" onClick={() => sendReaction('😂')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }} disabled={!streamActive}>😂</button>
            <button type="button" onClick={() => sendReaction('🔥')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }} disabled={!streamActive}>🔥</button>
            <button type="button" onClick={() => sendReaction('😍')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }} disabled={!streamActive}>😍</button>
          </div>
        </div>
        {liveSessionId && streamActive && !hasActiveAuction && <AuctionLauncher liveSessionId={liveSessionId} hasActiveAuction={hasActiveAuction} />}
        {liveSessionId && streamActive && auction && auction.status === 'active' && <ActiveAuctionPanel auction={auction} secondsRemaining={secondsRemaining} />}
      </div>
    </div>
  );
};

export default SellerLiveStudio;

