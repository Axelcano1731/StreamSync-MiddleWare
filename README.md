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
Flujo de datos

TikTok Live Connector escucha eventos en vivo de TikTok:

Likes

Mensajes

Seguidores

Donaciones

El backend recibe estos eventos y los envía al frontend mediante Socket.IO.

El frontend React los muestra en tiempo real en una interfaz tipo chat.

Eventos disponibles
Evento	Descripción
like	Cuando un usuario envía un like
chat	Cuando alguien envía un mensaje
follow	Cuando un usuario sigue la cuenta
gift	Cuando alguien envía un regalo
Personalización

Si deseas modificar el diseño:

Edita los componentes en la carpeta frontend/src/.

Ajusta estilos con TailwindCSS o clases personalizadas.

Problemas comunes
Problema	Solución
CORS error en el frontend	Asegúrate de que el backend esté corriendo en el puerto 3000 y que ambos estén conectados correctamente.
Error conectando al Live	Verifica el nombre de usuario de TikTok y que estés transmitiendo en vivo.
No cargan mensajes en el frontend	Comprueba que Socket.IO esté emitiendo eventos desde el backend.
npm run dev no inicia	Asegúrate de estar en la carpeta correcta y haber ejecutado npm install.
Futuras mejoras

📊 Panel de estadísticas en tiempo real.

🔔 Sistema de alertas para donaciones y seguidores.

💾 Guardar eventos en base de datos.

🌍 Despliegue en producción (Vercel/Render).

Licencia

Este proyecto se distribuye bajo la licencia MIT.
Puedes usarlo y modificarlo libremente para tus proyectos personales o comerciales.

Créditos

Autores: Axel Cano y Wiliam Gazabon

Librerías clave:

tiktok-live-connector

Socket.IO

React