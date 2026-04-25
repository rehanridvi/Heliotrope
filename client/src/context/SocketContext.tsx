import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket] = useState(() => io(SOCKET_URL, { autoConnect: false }));

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): Socket | null => {
  return useContext(SocketContext);
};

