StreamSync - TikTok Live

StreamSync es una aplicación que conecta TikTok Live con un frontend en tiempo real para visualizar likes, mensajes de chat, seguidores y donaciones.
Este proyecto utiliza Node.js, Socket.IO, React, y la librería tiktok-live-connector.

Características principales

📡 Conexión en tiempo real a TikTok Live

❤️ Muestra de likes en vivo

💬 Visualización de mensajes del chat en tiempo real

➕ Notificaciones de nuevos seguidores

🎁 Registro de donaciones con detalles completos

⚡ Actualización instantánea en el frontend con Socket.IO

Tecnologías utilizadas
Tecnología	Uso en el proyecto
Node.js	Backend y servidor principal
React.js	Frontend dinámico
Socket.IO	Comunicación en tiempo real
TikTok Live Connector	Conexión con la API de TikTok
TailwindCSS	Estilos y diseño moderno
Requisitos previos

Antes de comenzar, asegúrate de tener instalado:

## Requisitos previos

- **Node.js** (v18 o superior)  
- **npm** o **Yarn**  
- Una cuenta de TikTok con transmisión en vivo activa (nombre de usuario sin `@`)

## Instalación

Sigue estos pasos para clonar y ejecutar el proyecto localmente:

1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/streamsync-tiktok.git
cd streamsync-tiktok
```

2️⃣ Instalar dependencias
Backend
```bash
cd backend
npm install
```

Frontend
```bash
cd ../frontend
npm install
```

3️⃣ Configuración del backend

Edita el archivo server.js en la carpeta backend y coloca tu nombre de usuario de TikTok:

```bash 
const tiktokUsername = 'TU_USUARIO_TIKTOK';
```


⚠️ Importante: No coloques el símbolo @, solo el nombre de usuario.

4️⃣ Iniciar los servidores
Backend
```bash 
cd backend
npm run dev
```


El backend se ejecutará en:
```bash 
http://localhost:3000
```

Frontend

En otra terminal:
```bash 
cd frontend
npm start
```


El frontend se ejecutará en:
```bash 
http://localhost:5173
```

El puerto puede variar dependiendo de la configuración de Vite.

Estructura del proyecto
```bash 
streamsync-tiktok/
│
├── backend/                # Servidor Node.js
│   ├── server.js           # Código principal del servidor
│   ├── package.json
│   └── ...
│
├── frontend/               # Aplicación React
│   ├── src/
│   │   ├── App.jsx
│   │   └── ...
│   ├── public/
│   ├── package.json
│   └── ...
│
└── README.md
```
## 🔄 Flujo de datos

El sistema funciona en tres capas principales:

1. **TikTok Live Connector**  
   Escucha en tiempo real los eventos de la transmisión (likes, mensajes, seguidores y regalos).

2. **Backend (Node.js + Socket.IO)**  
   Recibe los eventos capturados y los normaliza. Luego los emite hacia el frontend mediante **WebSockets**.

3. **Frontend (React + Tailwind)**  
   Muestra los eventos al usuario en tiempo real dentro de una interfaz tipo chat.

---

### 📡 Eventos disponibles

| Evento  | Descripción |
|---------|-------------|
| `like`  | Se dispara cuando un usuario envía un ❤️ like. |
| `chat`  | Cuando alguien envía un 💬 mensaje en el chat. |
| `follow`| Cuando un usuario comienza a seguir la cuenta. |
| `gift`  | Cuando alguien envía un 🎁 regalo durante la transmisión. |

---

## 🎨 Personalización

- Edita los componentes en la carpeta **`frontend/src/`**.  
- Ajusta los estilos con **TailwindCSS** o clases personalizadas.  
- Puedes agregar animaciones, alertas en pantalla o paneles de estadísticas según tu necesidad.  

---

## ⚠️ Problemas comunes

| Problema | Posible solución |
|----------|------------------|
| **CORS error en el frontend** | Asegúrate de que el backend esté en el puerto `3000` y que ambos servicios estén conectados correctamente. |
| **Error conectando al Live** | Verifica el nombre de usuario de TikTok y que la transmisión en vivo esté activa. |
| **No cargan mensajes en el frontend** | Comprueba que **Socket.IO** esté emitiendo eventos desde el backend. |
| **`npm run dev` no inicia** | Verifica que estés en la carpeta correcta y hayas ejecutado `npm install`. |

---

## 🚀 Futuras mejoras

- 📊 Panel de **estadísticas en tiempo real**.  
- 🔔 Sistema de **alertas visuales y sonoras** para donaciones y seguidores.  
- 💾 **Persistencia en base de datos** para guardar los eventos.  
- 🌍 **Despliegue en producción** con Vercel, Render o similares.  

---

## 📜 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.  
Puedes usarlo y modificarlo libremente para tus proyectos personales o comerciales.

---

## 👥 Créditos

- **Autores:** Axel Cano y Wiliam Gazabon  
- **Librerías clave:**  
  - [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector)  
  - [Socket.IO](https://socket.io/)  
  - [React](https://reactjs.org/)  
