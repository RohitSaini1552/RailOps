import { io } from 'socket.io-client';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const socketBaseUrl = new URL(apiBaseUrl, window.location.origin).origin;

const socket = io(socketBaseUrl, {
  autoConnect: false,
  transports: ['websocket']
});

export default socket;