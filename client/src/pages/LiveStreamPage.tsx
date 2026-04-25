import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { getSessionByChannelName } from '../services/liveService';
import { useAuction } from '../context/AuctionContext';
import AuctionBidPanel from '../components/live/AuctionBidPanel';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

const LiveStreamPage: React.FC = () => {
  const { channelName } = useParams();
  const socket = useSocket();
  const { user } = useAuth();
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [streamActive, setStreamActive] = useState(false);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const { auction, secondsRemaining, setLiveSessionId: setAuctionSessionId } = useAuction();
  
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const offerRetryTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!channelName) return;
    getSessionByChannelName(channelName)
      .then((session) => {
        setLiveSessionId(session?._id || null);
        setStreamTitle(session?.title || '');
        setSellerName(session?.sellerName || '');
        setStreamActive(Boolean(session?.isActive));
      })
      .catch(() => {
        setLiveSessionId(null);
        setStreamTitle('');
        setSellerName('');
        setStreamActive(false);
        setLoadError('Live session not found');
      });
  }, [channelName]);

  useEffect(() => {
    setAuctionSessionId(liveSessionId);
    return () => setAuctionSessionId(null);
  }, [liveSessionId, setAuctionSessionId]);

  useEffect(() => {
    if (!channelName) return;
    api
      .get(`/live/${channelName}/comments`)
      .then((res) => setComments(res.data?.comments || []))
      .catch(() => setComments([]));
  }, [channelName]);

  // Clear offer retry timer
  const clearOfferRetryTimer = () => {
    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }
  };

  // Create peer connection
  const createPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    });

    // FIX 3: DO NOT add recvonly transceivers - let ontrack handle it reactively
    // Removed: pc.addTransceiver('video', { direction: 'recvonly' });
    // Removed: pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          // FIX 2: Explicitly call load and play
          remoteVideoRef.current.load();
          remoteVideoRef.current.play().catch(err => console.warn('autoplay blocked', err));
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelName && socket) {
        socket.emit('ice-candidate', {
          targetSocketId: socket.id,
          candidate: event.candidate,
          channelName,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('Connection failed, requesting new offer');
        requestNewOffer();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Request offer from seller
  const requestNewOffer = () => {
    if (!socket || !channelName) return;
    if (!offerRetryTimerRef.current) {
      offerRetryTimerRef.current = setInterval(() => {
        socket.emit('viewer-request-offer', { channelName });
      }, 500);
    }
  };

  // Handle seller's offer
  const onSellerOffer = async ({ offer, sellerSocketId }: { offer: RTCSessionDescriptionInit; sellerSocketId: string }) => {
    // FIX 4: Stop the retry interval immediately when offer arrives
    clearOfferRetryTimer();

    try {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket && channelName) {
        socket.emit('viewer-answer', {
          answer,
          sellerSocketId,
          channelName,
        });
      }
    } catch (err) {
      console.error('Failed to handle seller offer:', err);
    }
  };

  // Handle ICE candidate
  const onIceCandidate = async ({ candidate, fromSocketId }: { candidate: RTCIceCandidate }) => {
    if (peerConnectionRef.current && candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket || !channelName) return;
    socket.emit('viewer-join', {
      channelName,
      viewerName: user?.name || 'Viewer',
      viewerSocketId: socket.id,
    });

    // Request initial offer
    requestNewOffer();

    const onComment = (payload: LiveComment) => {
      setComments((prev) => [...prev.slice(-99), payload]);
    };
    const onStarted = () => setStreamActive(true);
    const onEnded = () => setStreamActive(false);
    const onReaction = (payload: LiveReaction) => {
      setReactions((prev) => [...prev, payload]);
      setTimeout(() => {
        setReactions((prev) => prev.filter(r => r.id !== payload.id));
      }, 2000);
    };

    socket.on('new-comment', onComment);
    socket.on('stream-started', onStarted);
    socket.on('stream-ended', onEnded);
    socket.on('seller-offer', onSellerOffer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('new-reaction', onReaction);

    return () => {
      socket.emit('viewer-leave', { channelName });
      socket.off('new-comment', onComment);
      socket.off('stream-started', onStarted);
      socket.off('stream-ended', onEnded);
      socket.off('seller-offer', onSellerOffer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('new-reaction', onReaction);
      clearOfferRetryTimer();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [socket, channelName, user?.name]);

  // FIX 2: Add useEffect to assign srcObject after mount
  useEffect(() => {
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  });

  const sendComment = () => {
    if (!socket || !channelName || !chatMessage.trim()) return;
    socket.emit('send-comment', {
      channelName,
      username: user?.name || 'Guest',
      text: chatMessage.trim(),
      timestamp: Date.now(),
    });
    setChatMessage('');
  };

  const sendReaction = (emoji: string) => {
    if (!socket || !channelName) return;
    socket.emit('send-reaction', {
      channelName,
      emoji,
      username: user?.name || 'Guest',
    });
  };

  const showAuctionPanel = useMemo(() => {
    if (!auction || auction.status !== 'active') return false;
    if (!user) return true;
    return user.role === 'buyer';
  }, [auction, user]);

  return (
    <div className="dash-wrap">
      <div className="live-shell">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div className="live-badge"><span className="live-badge-dot" /> {streamActive ? 'LIVE' : 'OFFLINE'}</div>
          <Link to="/live" className="btn-secondary">Back to Streams</Link>
        </div>
        <div className="live-video-container" style={{ position: 'relative' }}>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
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
        </div>
        <div className="live-chat" style={{ marginTop: '1rem', height: 300 }}>
          <div className="live-chat-header">Live Chat</div>
          <div className="live-chat-body">
            {comments.length === 0 ? (
              <div className="chat-message"><div className="chat-message-author">System</div><div className="chat-message-text">Welcome to the live stream!</div></div>
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
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendComment();
              }}
            />
            <button className="btn-primary" type="button" onClick={sendComment} disabled={!chatMessage.trim()}>Send</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button type="button" onClick={() => sendReaction('👍')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>👍</button>
            <button type="button" onClick={() => sendReaction('❤️')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>❤️</button>
            <button type="button" onClick={() => sendReaction('😂')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>😂</button>
            <button type="button" onClick={() => sendReaction('🔥')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>🔥</button>
            <button type="button" onClick={() => sendReaction('😍')} style={{ padding: '0.5rem', fontSize: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>😍</button>
          </div>
        </div>
        {loadError && <p className="auth-error" style={{ marginTop: '1rem' }}>{loadError}</p>}
        {showAuctionPanel && auction && auction.status === 'active' && <AuctionBidPanel auction={auction} secondsRemaining={secondsRemaining} />}
      </div>
    </div>
  );
};

export default LiveStreamPage;

