import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: `${API_URL}/api/live` });

export const getActiveSessions = async () => {
  const res = await api.get('/active');
  return res.data.sessions || [];
};

export const getSessionByChannelName = async (channelName: string) => {
  const res = await api.get(`/${channelName}`);
  return res.data.session || null;
};

