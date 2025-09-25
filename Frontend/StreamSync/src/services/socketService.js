// services/socketService.js
import io from "socket.io-client";

const socket = io("http://localhost:3000"); // URL del backend

export default socket;
