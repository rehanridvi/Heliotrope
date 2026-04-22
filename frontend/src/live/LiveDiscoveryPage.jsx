import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../api';
import { listActiveLiveSessions } from './liveApi';

function formatTime(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
}

export default function LiveDiscoveryPage() {
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const load = async () => {
    try {
      setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
      const data = await listActiveLiveSessions();
      setSessions(data);
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasAny = sessions.length > 0;
  const emptyMessage = useMemo(() => {
    if (status === 'loading') return 'Checking for live sessions…';
    if (status === 'error') return 'Could not load live sessions right now.';
    return 'No live sessions right now.';
  }, [status]);

  return (
    <div className="min-h-[calc(100vh-88px)] bg-gradient-to-b from-slate-950 via-[#140f29] to-gray-950 text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Live streams</h1>
            <p className="mt-1 text-sm text-gray-400">
              Join sellers streaming in real-time.
            </p>
          </div>
          <Link
            to="/seller/live"
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
          >
            Go live (Seller)
          </Link>
        </div>

        {!hasAny ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl shadow-black/30">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-rose-500/20" />
            <div className="text-lg font-semibold">{emptyMessage}</div>
            <div className="mt-2 text-sm text-gray-400">
              When a seller starts streaming, it will appear here automatically.
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <div
                key={s.channelName}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-black/25 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative h-40 bg-gray-900">
                  {s.storefrontThumbnail ? (
                    <img
                      src={getImageUrl(s.storefrontThumbnail)}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" />
                    LIVE
                  </div>
                  <div className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold">
                    {Number(s.viewerCount) || 0} watching
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm text-gray-400">
                    {s.sellerName}
                    {s.storefrontName ? ` • ${s.storefrontName}` : ''}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-snug">{s.title}</div>
                  <div className="mt-2 text-xs text-gray-500">
                    Started: {formatTime(s.startedAt)}
                  </div>
                  <div className="mt-4">
                    <Link
                      to={`/live/${encodeURIComponent(s.channelName)}`}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-400"
                    >
                      Join Stream
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

