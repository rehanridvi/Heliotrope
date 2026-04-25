import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SearchProvider } from './context/SearchContext';
import { SocketProvider } from './context/SocketContext';
import { AuctionProvider } from './context/AuctionContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <SocketProvider>
            <AuctionProvider>
              <App />
            </AuctionProvider>
          </SocketProvider>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>,
);
