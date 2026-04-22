import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../api';
import * as mp from '../marketplaceApi';
import { createLiveSocket, ICE_SERVERS } from '../realtime/liveSocket';
import { endLiveSession, startLiveSession } from './liveApi';

function safeName(v, fallback, maxLen) {
  const s = String(v || '').trim();
  return s ? s.slice(0, maxLen) : fallback;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function SellerLivePage() {
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef({}); // { [viewerSocketId]: RTCPeerConnection }
  const queuedCandidatesByViewerRef = useRef({}); // { [viewerSocketId]: RTCIceCandidateInit[] }
  const scrollRef = useRef(null);
  const channelNameRef = useRef('');

  const [channelName, setChannelName] = useState('');
  const [title, setTitle] = useState('Live selling session');
  const [status, setStatus] = useState('starting'); // starting | live | ended | error
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [permissionMsg, setPermissionMsg] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [myProducts, setMyProducts] = useState([]);
  const [pinnedProduct, setPinnedProduct] = useState(null);

  const sellerId = useMemo(() => safeName(localStorage.getItem('sellerId'), 'demo_seller_123', 120), []);
  const sellerName = useMemo(() => safeName(localStorage.getItem('sellerName'), 'Seller', 80), []);

  const stopAllMedia = () => {
    const s = localStreamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const closeAllPeers = () => {
    const peers = peersRef.current;
    for (const id of Object.keys(peers)) {
      try {
        peers[id].close();
      } catch {
        /* noop */
      }
    }
    peersRef.current = {};
    queuedCandidatesByViewerRef.current = {};
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatus('starting');
      setErrorMsg('');
      setPermissionMsg('');
      setComments([]);
      setViewerCount(0);

      // Create socket EARLY
      const socket = createLiveSocket();
      socketRef.current = socket;

      let session;
      try {
        session = await startLiveSession({
          sellerId,
          sellerName,
          title,
        });
      } catch (e) {
        const statusCode = e?.response?.status;
        const apiError =
          e?.response?.data?.error || e?.response?.data?.message || e?.message;
        setErrorMsg(
          `Failed to start the live stream (API ${
            statusCode || 'error'
          }): ${apiError || 'Please try again.'}`
        );
        setStatus('error');
        socket.disconnect();
        return;
      }
      if (cancelled) return;

      setChannelName(session.channelName);
      channelNameRef.current = session.channelName;
      setPinnedProduct(session.pinnedProduct || null);

      // Register socket handlers BEFORE media setup so buyers can connect immediately
      const onConnect = () => {
        socket.emit('seller-start-stream', { channelName: session.channelName });
        setStatus('live');
      };

      const onNewViewer = async ({ viewerSocketId }) => {
        const viewerId = viewerSocketId;
        if (!viewerId) return;
        
        const currentStream = localStreamRef.current;
        if (!currentStream) {
          // Stream not ready yet, don't create offer
          return;
        }

        const existingPc = peersRef.current[viewerId];
        if (existingPc) {
          const state = existingPc.connectionState;
          // Buyer can trigger duplicate offer requests; keep active peer stable.
          if (state === 'new' || state === 'connecting' || state === 'connected') {
            return;
          }
          try {
            existingPc.close();
          } catch {
            /* noop */
          }
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current[viewerId] = pc;

        for (const track of currentStream.getTracks()) {
          pc.addTrack(track, currentStream);
        }

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          socket.emit('ice-candidate', {
            channelName: session.channelName,
            targetSocketId: viewerId,
            candidate: event.candidate.toJSON(),
          });
        };

        pc.onicegatheringstatechange = () => {
          console.log('[webrtc] seller ice gathering state:', pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[webrtc] seller ice connection state:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
          console.log('[webrtc] seller connection state for viewer', viewerId, ':', pc.connectionState);
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            try {
              pc.close();
            } catch {
              /* noop */
            }
            delete peersRef.current[viewerId];
            delete queuedCandidatesByViewerRef.current[viewerId];
          }
        };

        pc.onsignalingstatechange = () => {
          console.log('[webrtc] seller signaling state:', pc.signalingState);
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log('[webrtc] seller sending offer to viewer', viewerId);
          socket.emit('seller-offer', {
            channelName: session.channelName,
            targetSocketId: viewerId,
            offer,
          });
        } catch (e) {
          console.error('[webrtc] createOffer failed', e);
          try {
            pc.close();
          } catch {
            /* noop */
          }
          delete peersRef.current[viewerId];
        }
      };

      const onViewerAnswer = async ({ answer, viewerSocketId }) => {
        const pc = peersRef.current[viewerSocketId];
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          const queued = queuedCandidatesByViewerRef.current[viewerSocketId] || [];
          delete queuedCandidatesByViewerRef.current[viewerSocketId];
          for (const c of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (iceErr) {
              console.warn('[webrtc] queued addIceCandidate failed', iceErr);
            }
          }
        } catch (e) {
          console.error('[webrtc] setRemoteDescription failed', e);
        }
      };

      const onIceCandidate = async ({ candidate, fromSocketId }) => {
        const pc = peersRef.current[fromSocketId];
        if (!pc) return;
        if (!pc.remoteDescription) {
          if (!queuedCandidatesByViewerRef.current[fromSocketId]) {
            queuedCandidatesByViewerRef.current[fromSocketId] = [];
          }
          queuedCandidatesByViewerRef.current[fromSocketId].push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[webrtc] addIceCandidate failed', e);
        }
      };

      const onViewerLeft = ({ viewerSocketId }) => {
        const pc = peersRef.current[viewerSocketId];
        if (pc) {
          try {
            pc.close();
          } catch {
            /* noop */
          }
          delete peersRef.current[viewerSocketId];
          delete queuedCandidatesByViewerRef.current[viewerSocketId];
        }
      };

      const onViewerCount = ({ count }) => setViewerCount(Number(count) || 0);

      const onViewerRequestOffer = ({ viewerSocketId }) => {
        if (viewerSocketId) {
          onNewViewer({ viewerSocketId });
        }
      };

      const onNewComment = (c) => {
        setComments((prev) => [...prev, c].slice(-250));
        queueMicrotask(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          });
        });
      };

      const onStreamEnded = () => {
        setStatus('ended');
        closeAllPeers();
        stopAllMedia();
      };

      const onProductPinned = (p) => setPinnedProduct(p);
      const onProductUnpinned = () => setPinnedProduct(null);

      // Register handlers NOW, before media setup
      socket.on('connect', onConnect);
      socket.on('new-viewer', onNewViewer);
      socket.on('viewer-answer', onViewerAnswer);
      socket.on('viewer-request-offer', onViewerRequestOffer);
      socket.on('ice-candidate', onIceCandidate);
      socket.on('viewer-left', onViewerLeft);
      socket.on('viewer-count-update', onViewerCount);
      socket.on('new-comment', onNewComment);
      socket.on('stream-ended', onStreamEnded);
      socket.on('product-pinned', onProductPinned);
      socket.on('product-unpinned', onProductUnpinned);

      if (socket.connected) onConnect();

      // NOW get media
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionMsg(
          'Camera API is unavailable in this browser/context. Use HTTPS or localhost and try again.'
        );
        setStatus('error');
        return;
      }

      let stream;
      try {
        // Keep camera required, but microphone optional.
        // Some users allow camera but block mic; requesting both at once fails entirely.
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream = videoStream;
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
        } catch (audioErr) {
          console.warn('[live] microphone unavailable; continuing with camera only', audioErr);
        }
      } catch (e) {
        console.error(e);
        setPermissionMsg(
          'Camera access failed. Ensure camera permission is allowed, no other app is locking it, then reload.'
        );
        setStatus('error');
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
        } catch (playErr) {
          console.warn('[live] local video autoplay failed', playErr);
        }
      }

      return () => {
        socket.off('connect', onConnect);
        socket.off('new-viewer', onNewViewer);
        socket.off('viewer-answer', onViewerAnswer);
        socket.off('viewer-request-offer', onViewerRequestOffer);
        socket.off('ice-candidate', onIceCandidate);
        socket.off('viewer-left', onViewerLeft);
        socket.off('viewer-count-update', onViewerCount);
        socket.off('new-comment', onNewComment);
        socket.off('stream-ended', onStreamEnded);
        socket.off('product-pinned', onProductPinned);
        socket.off('product-unpinned', onProductUnpinned);
      };
    };

    let cleanupListeners = null;
    run()
      .then((maybeCleanup) => {
        cleanupListeners = typeof maybeCleanup === 'function' ? maybeCleanup : null;
      })
      .catch((e) => {
        console.error(e);
        setErrorMsg(`Failed to start the live stream: ${e?.message || 'Please try again.'}`);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (cleanupListeners) cleanupListeners();

      const socket = socketRef.current;
      const room = channelNameRef.current;
      if (socket && room) {
        socket.emit('seller-end-stream', { channelName: room });
      }
      socket?.disconnect();
      socketRef.current = null;

      closeAllPeers();
      stopAllMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, sellerName]);

  const openPinModal = async () => {
    try {
      setShowPinModal(true);
      const data = await mp.getMyStorefront();
      setMyProducts(data.products || []);
    } catch (e) {
      console.error(e);
      setMyProducts([]);
    }
  };

  const pin = (p) => {
    if (!channelName) return;
    socketRef.current?.emit('pin-product', {
      channelName,
      productId: p._id,
      name: p.name,
      price: Number(p.price) || 0,
      image: p.imageUrl || null,
      link: '', // storefront link can be wired if you have a product page route
    });
    setShowPinModal(false);
  };

  const unpin = () => {
    if (!channelName) return;
    socketRef.current?.emit('unpin-product', { channelName });
  };

  const sendComment = (e) => {
    e.preventDefault();
    const msg = commentText.trim();
    if (!msg || !channelName) return;
    socketRef.current?.emit('send-comment', {
      channelName,
      username: sellerName,
      text: msg,
      timestamp: Date.now(),
      avatar: null,
    });
    setCommentText('');
  };

  const end = async () => {
    try {
      if (channelName) {
        socketRef.current?.emit('seller-end-stream', { channelName });
        await endLiveSession(channelName);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStatus('ended');
      closeAllPeers();
      stopAllMedia();
      navigate('/marketplace');
    }
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              LIVE STUDIO
            </span>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              {viewerCount} watching
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Status: {status}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-600">You are live as {sellerName}</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">Seller Live Studio</div>
            {channelName ? (
              <div className="mt-1 rounded-xl bg-slate-100 px-3 py-1 text-xs text-slate-600">
                Channel: {channelName}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPinModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={status !== 'live'}
            >
              Pin Product
            </button>
            <button
              type="button"
              onClick={end}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
            >
              End Stream
            </button>
          </div>
        </div>
        </div>

        {(permissionMsg || errorMsg) && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
            <div className="font-semibold text-red-700">Unable to start stream</div>
            <div className="mt-1 text-red-600">{permissionMsg || errorMsg}</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-[62vh] w-full bg-gray-900 object-cover"
              />

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600/95 px-3 py-1 text-xs font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" />
                LIVE
              </div>
              <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                {viewerCount} watching
              </div>

              {pinnedProduct ? (
                <div className="absolute bottom-4 left-4 w-[340px] rounded-2xl border border-white/20 bg-black/55 p-3 text-white backdrop-blur-md">
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
                      <div className="truncate text-sm font-semibold">{pinnedProduct.name}</div>
                      <div className="mt-0.5 text-xs text-slate-200">
                        ৳{Number(pinnedProduct.price) || 0}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/30"
                          onClick={unpin}
                        >
                          Unpin
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="flex h-[62vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Live comments</div>
                    <div className="text-xs text-slate-500">
                      Reply quickly to keep viewers engaged.
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {comments.length} messages
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3">
                {comments.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    No comments yet. Greet your viewers to start the chat.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white">
                              {String(c.username || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {c.username}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">{formatTime(c.timestamp)}</div>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {c.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-3">
                <form onSubmit={sendComment} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={500}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                    disabled={status !== 'live'}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                    disabled={status !== 'live'}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPinModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Pin a product</div>
                <div className="text-xs text-slate-500">Choose one product to feature.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-5">
              {myProducts.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No products found in your storefront.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {myProducts.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => pin(p)}
                      className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100"
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-200">
                        {p.imageUrl ? (
                          <img
                            src={getImageUrl(p.imageUrl)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                        <div className="mt-1 text-xs text-slate-500">৳{Number(p.price) || 0}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

