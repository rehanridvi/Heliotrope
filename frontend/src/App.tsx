import { useState } from 'react';
import { LayoutGrid, Store } from 'lucide-react';
import ClosetView from './ClosetView';
import Marketplace from './Marketplace';
import './App.css';

export default function App() {
  const [view, setView] = useState<'closet' | 'marketplace'>('closet');

  return (
    <div className="app-container">
      <header className="glass app-global-nav">
        <div className="header-content">
          <div className="app-nav-pills">
            <button
              type="button"
              className={view === 'closet' ? 'nav-pill active' : 'nav-pill'}
              onClick={() => setView('closet')}
            >
              <LayoutGrid size={18} /> Digital Closet
            </button>
            <button
              type="button"
              className={view === 'marketplace' ? 'nav-pill active' : 'nav-pill'}
              onClick={() => setView('marketplace')}
            >
              <Store size={18} /> Marketplace
            </button>
          </div>
        </div>
      </header>
      {view === 'closet' ? <ClosetView /> : <Marketplace />}
    </div>
  );
}
