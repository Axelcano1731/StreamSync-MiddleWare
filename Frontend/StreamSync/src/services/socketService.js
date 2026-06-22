// services/socketService.js
import { io } from "socket.io-client";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get('backendPort') || '3000';
const socket = io(`http://localhost:${backendPort}`); // URL del backend

export default socket;
