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
## Requisitos previos

- **Node.js** (v18 o superior)  
- **npm** o **Yarn**  
- Una cuenta de TikTok con transmisión en vivo activa (nombre de usuario sin `@`)

---

## 🛠️ Instalación paso a paso

El proyecto se compone de tres módulos principales: **Backend**, **Frontend**, y **Electron** (opcional, para versión de escritorio).

### 1. Clonar el repositorio
```bash
git clone https://github.com/Axelcano1731/StreamSync-MiddleWare.git
cd StreamSync-MiddleWare
```

### 2. Instalar dependencias

**Para el Backend:**
```bash
cd Backend
npm install
```

**Para el Frontend:**
```bash
cd ../Frontend
npm install
```

**Para Electron (Opcional - App de Escritorio):**
```bash
cd ../Electron
npm install
```

---

## 🚀 Tutorial de Ejecución

Una vez instalado, aquí te explicamos cómo lanzar todos los módulos del sistema y el juego a la vez.

### Paso 1: Iniciar el servidor Backend
El backend es el núcleo de StreamSync. Maneja la conexión con TikTok, los websockets y sirve **los overlays y el juego de Wordle**.

Abre una terminal en la raíz del proyecto y ejecuta:
```bash
cd Backend
npm run dev
```
Verás en la consola que el servidor arranca en `http://localhost:3000`. 
*(¡Déjalo corriendo!)*

### Paso 2: Iniciar el Panel de Control (Frontend)
El Frontend te permite configurar la conexión, ver las estadísticas en tiempo real y el chat.

Abre **otra ventana de terminal** en la raíz del proyecto y ejecuta:
```bash
cd Frontend
npm run dev
```
El panel estará disponible en **`http://localhost:5173`**. Ábrelo en tu navegador y configura ahí tu usuario de TikTok.

### Paso 3: Jugar Wordle Interactivo
El Wordle interactivo para el chat se comunica a través del sistema, y el Backend **lo sirve automáticamente**. No necesitas iniciar otro servidor para el juego.

1. Asegúrate de tener el **Backend corriendo** (Paso 1).
2. Asegúrate de estar conectado a tu live en el panel Frontend (Paso 2).
3. Abre en tu navegador (o agrégalo como Fuente de Navegador en **OBS Studio**):
   **👉 `http://localhost:3000/games/wordle/`**

¡Listo! El juego cargará y comenzará a capturar las palabras de 5 letras que los usuarios escriban en el chat de tu directo en TikTok.

### Opcional: Versión de Escritorio (Electron)
Si prefieres no usar el navegador para el panel de control, puedes abrirlo como una app de escritorio nativa usando Electron.

**Para modo desarrollo:**
```bash
cd Electron
npm run dev
```

**Para Empaquetar / Construir la App (Windows):**
Si estás en Windows y utilizas PowerShell, comandos combinados con `&&` pueden dar error. Para construir y empaquetar la aplicación correctamente sin fallos, ejecuta los siguientes pasos uno por uno en la consola, desde la raíz del proyecto:

1. **Construir el Frontend:**
   ```powershell
   npm run build --prefix Frontend/StreamSync
   ```

2. **Empaquetar la aplicación con Electron:**
   ```powershell
   npm run build:win --prefix Electron
   ```

Una vez finalizado, encontrarás el instalador (`StreamSync-Setup-1.0.0.exe`) dentro de la carpeta `dist` en la raíz del proyecto.

---

Estructura del proyecto:
```bash 
StreamSync-MiddleWare/
│
├── Backend/                # Servidor Node.js (Websockets, Overlays, Host de juegos)
├── Frontend/               # Panel de control en React/Vite
├── Electron/               # Empaquetado de escritorio
├── games/                  # Juegos para streamers
│   └── wordle/             # Wordle interactivo
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
