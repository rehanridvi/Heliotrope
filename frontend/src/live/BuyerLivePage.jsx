import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getImageUrl } from '../api';
import { createLiveSocket, ICE_SERVERS } from '../realtime/liveSocket';
import { getLiveSession } from './liveApi';
import './live.css';

function safeName(v, fallback) {
  const s = String(v || '').trim();
  return s ? s.slice(0, 60) : fallback;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function BuyerLivePage() {
  const { channelName: rawChannelName } = useParams();
  const channelName = rawChannelName || '';

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | live | waiting
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [floating, setFloating] = useState([]); // {id, emoji, left}
  const [pinnedProduct, setPinnedProduct] = useState(null);

  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const sellerSocketIdRef = useRef(null);
  const queuedCandidatesRef = useRef([]);
  const remoteDescriptionSetRef = useRef(false);
  const queuedRemoteCandidatesRef = useRef([]);
  const reconnectTimerRef = useRef(null);
  const offerRetryTimerRef = useRef(null);
  const hasRemoteTrackRef = useRef(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  });

  const viewerName = useMemo(() => {
    return safeName(localStorage.getItem('viewerName'), 'Buyer');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const s = await getLiveSession(channelName);
        if (cancelled) return;
        setSession(s);
        setViewerCount(Number(s.viewerCount) || 0);
        setPinnedProduct(s.pinnedProduct || null);
        setEnded(!s.isActive);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (channelName) run();
    return () => {
      cancelled = true;
    };
  }, [channelName]);

  useEffect(() => {
    if (!channelName) return;

    const socket = createLiveSocket();
    socketRef.current = socket;
    let disposed = false;

    const resetRemoteStream = () => {
      const prev = remoteStreamRef.current;
      if (prev) {
        prev.getTracks().forEach((t) => t.stop?.());
      }
      const next = new MediaStream();
      remoteStreamRef.current = next;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = next;
        console.log('[live] remote stream reset and assigned to video element');
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    const clearOfferRetryTimer = () => {
      if (offerRetryTimerRef.current) {
        window.clearInterval(offerRetryTimerRef.current);
        offerRetryTimerRef.current = null;
      }
    };

    const createPeerConnection = () => {
      try {
        pcRef.current?.close();
      } catch {
        /* noop */
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      remoteDescriptionSetRef.current = false;
      queuedCandidatesRef.current = [];
      queuedRemoteCandidatesRef.current = [];
      sellerSocketIdRef.current = null;
      hasRemoteTrackRef.current = false;
      resetRemoteStream();

      pc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;

        const incomingStream = event.streams?.[0] || null;
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== incomingStream) {
            remoteVideoRef.current.srcObject = incomingStream;
            remoteVideoRef.current.load();
            remoteVideoRef.current.play().catch((err) => {
              console.warn('autoplay blocked', err);
            });
          }
        } else {
          const currentRemoteStream = remoteStreamRef.current;
          if (currentRemoteStream && !currentRemoteStream.getTracks().some((t) => t.id === track.id)) {
            currentRemoteStream.addTrack(track);
          }
        }

        const startPlayback = () => {
          hasRemoteTrackRef.current = true;
          clearOfferRetryTimer();
          setConnectionStatus('live');
          setEnded(false);
          remoteVideoRef.current?.play?.().catch((err) => {
            console.warn('[live] remote autoplay blocked', err);
          });
        };

        startPlayback();
        if (track.kind === 'video' && track.muted) {
          track.onunmute = () => {
            startPlayback();
            track.onunmute = null;
          };
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const sellerSocketId = sellerSocketIdRef.current;
        if (!sellerSocketId) {
          queuedCandidatesRef.current.push(event.candidate.toJSON());
          return;
        }
        socket.emit('ice-candidate', {
          channelName,
          targetSocketId: sellerSocketId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.onicegatheringstatechange = () => {
        console.log('[webrtc] ice gathering state:', pc.iceGatheringState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[webrtc] ice connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
          setConnectionStatus('connecting');
          scheduleReconnect();
        }
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        console.log('[webrtc] connection state:', s);
        if (s === 'connected') {
          clearReconnectTimer();
          setConnectionStatus('live');
          setEnded(false);
          return;
        }
        if (s === 'failed' || s === 'disconnected') {
          setConnectionStatus('connecting');
          scheduleReconnect();
          return;
        }
        if (s === 'closed') {
          setConnectionStatus('waiting');
        }
      };

      pc.onsignalingstatechange = () => {
        console.log('[webrtc] signaling state:', pc.signalingState);
      };

      pc.ondatachannel = (event) => {
        console.log('[webrtc] data channel received:', event.channel.label);
      };
    };

    const emitJoinAndRequestOffer = () => {
      socket.emit('viewer-join', {
        channelName,
        viewerName,
        viewerSocketId: socket.id,
      });
      socket.emit('viewer-request-offer', { channelName });
      if (!offerRetryTimerRef.current) {
        // Retry quickly (every 500ms) until stream is established
        offerRetryTimerRef.current = window.setInterval(() => {
          if (disposed || hasRemoteTrackRef.current) {
            clearOfferRetryTimer();
            return;
          }
          socket.emit('viewer-request-offer', { channelName });
        }, 500);
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimerRef.current) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (disposed) return;
        setConnectionStatus('connecting');
        createPeerConnection();
        emitJoinAndRequestOffer();
      }, 1500);
    };

    setConnectionStatus('connecting');
    createPeerConnection();

    const onConnect = () => {
      setConnectionStatus('connecting');
      const pc = pcRef.current;
      if (!pc || pc.connectionState === 'closed') {
        createPeerConnection();
      }
      emitJoinAndRequestOffer();
    };

    const onStreamStarted = () => {
      setEnded(false);
      setConnectionStatus('connecting');
      const pc = pcRef.current;
      if (!pc || pc.connectionState === 'closed') {
        createPeerConnection();
      }
      emitJoinAndRequestOffer();
    };

    const onSellerOffer = async ({ offer, sellerSocketId }) => {
      clearOfferRetryTimer();
      try {
        let pc = pcRef.current;
        if (!pc || pc.connectionState === 'closed') {
          createPeerConnection();
          pc = pcRef.current;
        }
        if (!pc) return;

        // If a new offer arrives mid-negotiation, reset to a fresh peer for a clean handshake.
        if (pc.signalingState !== 'stable') {
          createPeerConnection();
          pc = pcRef.current;
        }

        sellerSocketIdRef.current = sellerSocketId;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        remoteDescriptionSetRef.current = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('viewer-answer', {
          channelName,
          sellerSocketId,
          answer,
        });
        const queued = queuedCandidatesRef.current.splice(0);
        for (const c of queued) {
          socket.emit('ice-candidate', {
            channelName,
            targetSocketId: sellerSocketId,
            candidate: c,
          });
        }
        const queuedRemote = queuedRemoteCandidatesRef.current.splice(0);
        for (const c of queuedRemote) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (iceErr) {
            console.warn('[webrtc] queued remote addIceCandidate failed', iceErr);
          }
        }
      } catch (e) {
        console.error('[webrtc] offer/answer failed', e);
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!remoteDescriptionSetRef.current || !pc.remoteDescription) {
        queuedRemoteCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[webrtc] addIceCandidate failed', e);
      }
    };

    const onStreamEnded = () => {
      setEnded(true);
      setConnectionStatus('waiting');
      clearReconnectTimer();
      clearOfferRetryTimer();
      try {
        pcRef.current?.close();
      } catch {
        /* noop */
      }
    };

    const onViewerCount = ({ count }) => setViewerCount(Number(count) || 0);

    const onNewComment = (c) => {
      setComments((prev) => [...prev, c].slice(-250));
      queueMicrotask(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    };

    const onNewReaction = (r) => {
      const id = r.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const left = 10 + Math.floor(Math.random() * 70);
      setFloating((prev) => [...prev, { id, emoji: r.emoji, left }].slice(-30));
      window.setTimeout(() => {
        setFloating((prev) => prev.filter((x) => x.id !== id));
      }, 2000);
    };

    const onProductPinned = (p) => setPinnedProduct(p);
    const onProductUnpinned = () => setPinnedProduct(null);

    socket.on('connect', onConnect);
    socket.on('stream-started', onStreamStarted);
    socket.on('seller-offer', onSellerOffer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('stream-ended', onStreamEnded);
    socket.on('viewer-count-update', onViewerCount);
    socket.on('new-comment', onNewComment);
    socket.on('new-reaction', onNewReaction);
    socket.on('product-pinned', onProductPinned);
    socket.on('product-unpinned', onProductUnpinned);

    if (socket.connected) onConnect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearOfferRetryTimer();
      socket.emit('viewer-leave', { channelName });
      socket.off('connect', onConnect);
      socket.off('stream-started', onStreamStarted);
      socket.off('seller-offer', onSellerOffer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('stream-ended', onStreamEnded);
      socket.off('viewer-count-update', onViewerCount);
      socket.off('new-comment', onNewComment);
      socket.off('new-reaction', onNewReaction);
      socket.off('product-pinned', onProductPinned);
      socket.off('product-unpinned', onProductUnpinned);
      socket.disconnect();
      socketRef.current = null;

      try {
        pcRef.current?.close();
      } catch {
        /* noop */
      }
      pcRef.current = null;
      remoteDescriptionSetRef.current = false;
      queuedCandidatesRef.current = [];
      queuedRemoteCandidatesRef.current = [];

      const v = remoteVideoRef.current;
      if (v?.srcObject) {
        v.srcObject.getTracks?.().forEach((t) => t.stop?.());
        v.srcObject = null;
      }
      remoteStreamRef.current = null;
    };
  }, [channelName, viewerName]);

  const sendComment = (e) => {
    e.preventDefault();
    const msg = commentText.trim();
    if (!msg) return;
    socketRef.current?.emit('send-comment', {
      channelName,
      username: viewerName,
      text: msg,
      timestamp: Date.now(),
      avatar: null,
    });
    setCommentText('');
  };

  const sendReaction = (emoji) => {
    socketRef.current?.emit('send-reaction', { channelName, emoji, username: viewerName });
  };

  if (loading) {
    return (
      <div className="buyer-live-shell min-h-[calc(100vh-88px)] text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="buyer-live-glass-card rounded-3xl p-10 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-fuchsia-300/30 border-t-fuchsia-300" />
            <div className="bg-gradient-to-r from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-2xl font-bold text-transparent">
              Loading your live experience...
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Syncing stream, chat, and reactions in real time.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="buyer-live-shell min-h-[calc(100vh-88px)] text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="buyer-live-glass-card rounded-3xl p-10">
            <div className="bg-gradient-to-r from-rose-200 via-orange-200 to-amber-200 bg-clip-text text-2xl font-bold text-transparent">
              Live session not found
            </div>
            <div className="mt-2 text-sm text-slate-600">
              It may have ended or the link is incorrect.
            </div>
            <div className="mt-6">
              <Link
                to="/live"
                className="inline-flex rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Back to Live discovery
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const reactionButtons = ['❤️', '🔥', '👏', '😮', '😂'];
  const isLive = connectionStatus === 'live' && !ended;

  return (
    <div className="buyer-live-shell min-h-[calc(100vh-88px)] text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        <div className="buyer-live-glass-card mb-5 rounded-3xl px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 px-3 py-1 text-xs font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
                Buyer Watch
              </span>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700">
                {viewerName}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                {isLive ? 'Live now' : connectionStatus === 'waiting' ? 'Seller offline' : 'Connecting...'}
              </span>
              <Link
                to="/live"
                className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
              >
                Back to streams
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-500">{session.sellerName}</div>
            <div className="buyer-live-title truncate text-2xl font-extrabold tracking-tight">
              {session.title}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="lg:col-span-7">
            <div className="buyer-live-glass-card relative overflow-hidden rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/70">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-[62vh] w-full bg-black object-cover"
              />

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500/95 to-orange-500/95 px-3 py-1 text-xs font-bold shadow-lg shadow-rose-900/30">
                <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" />
                LIVE
              </div>

              <div className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-cyan-700">
                {viewerCount} watching
              </div>

              <div className="absolute left-4 top-16 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {connectionStatus === 'live'
                  ? 'Connected in HD'
                  : connectionStatus === 'waiting'
                  ? 'Waiting for seller'
                  : 'Establishing stream...'}
              </div>

              {pinnedProduct ? (
                <div className="absolute bottom-4 left-4 w-[320px] rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100/90 to-cyan-100/90 p-3 backdrop-blur-md">
                  <div className="flex gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/10">
                      {pinnedProduct.image ? (
                        <img
                          src={getImageUrl(pinnedProduct.image)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-violet-800">{pinnedProduct.name}</div>
                      <div className="mt-0.5 text-xs font-semibold text-cyan-700">
                        ৳{Number(pinnedProduct.price) || 0}
                      </div>
                      {pinnedProduct.link ? (
                        <a
                          href={pinnedProduct.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View Product
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {ended ? (
                <div className="absolute inset-0 grid place-items-center bg-slate-900/45">
                  <div className="buyer-live-glass-card rounded-2xl p-6 text-center backdrop-blur">
                    <div className="bg-gradient-to-r from-rose-200 to-orange-200 bg-clip-text text-lg font-semibold text-transparent">
                      Stream has ended
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Thanks for watching. You can go back to discover other streams.
                    </div>
                    <div className="mt-5">
                      <Link
                        to="/live"
                        className="inline-flex rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
                      >
                        Browse live streams
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              {floating.map((r) => (
                <div
                  key={r.id}
                  className="pointer-events-none absolute bottom-6 text-3xl live-float-up"
                  style={{ left: `${r.left}%` }}
                >
                  {r.emoji}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="buyer-live-glass-card flex h-[62vh] flex-col overflow-hidden rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/70">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="bg-gradient-to-r from-fuchsia-200 to-cyan-200 bg-clip-text text-sm font-bold text-transparent">
                      Live chat
                    </div>
                    <div className="text-xs text-slate-500">
                      Be kind. Messages appear instantly.
                    </div>
                  </div>
                  <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {viewerCount} online
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3">
                {comments.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    No comments yet. Start the conversation!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500/70 to-rose-500/70 text-xs font-bold text-white">
                              {String(c.username || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="truncate bg-gradient-to-r from-fuchsia-200 to-cyan-200 bg-clip-text text-sm font-semibold text-transparent">
                              {c.username}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">{formatTime(c.timestamp)}</div>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {c.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {reactionButtons.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => sendReaction(e)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-fuchsia-50"
                      disabled={ended}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={sendComment}
                  className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-inner"
                >
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={500}
                    placeholder="Write a comment…"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                    disabled={ended}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    disabled={ended}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

