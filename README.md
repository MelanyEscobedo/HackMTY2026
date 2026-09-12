# Capital You — Capital One Challenge (HackMTY 2026)

Solución de inteligencia financiera autónoma desarrollada bajo el reto **Autonomous Financial Intelligence & Resilience** de Capital One en HackMTY 2026. El sistema analiza flujos de transacciones para anticipar problemas de liquidez, evaluar riesgos y ejecutar recomendaciones proactivas mediante una interfaz interactiva y voz ejecutiva.

---

## 🛠️ Stack Tecnológico

| Capa | Herramienta | Función Principal |
| :--- | :--- | :--- |
| **Frontend** | React (Vite) | Interfaz gráfica interactiva, gráficos temporales y action cards |
| **Backend** | FastAPI (Python 3.10+) | Orquestación de lógica de negocio, endpoints asíncronos y CORS |
| **Base de Datos** | MongoDB (Atlas / Local) | Almacenamiento no relacional para transacciones, alertas y perfiles |
| **Voz** | ElevenLabs API | Generación de resúmenes ejecutivos en audio |
| **Datos Financieros** | Capital One Nessie API | Ingesta y consulta de cuentas, clientes y transacciones simuladas[cite: 1] |
| **Dominio** | `.tech` | Dominio personalizado para la entrega y demo pública[cite: 1] |

---

## 📂 Estructura del Proyecto

```text
├── backend/
│   ├── venv/                 # Entorno virtual de Python (ignorado por Git)
│   ├── main.py               # Entrada de FastAPI, configuración CORS y rutas
│   ├── requirements.txt      # Paquetes y dependencias de Python
│   └── .env                  # Variables de entorno secretas del backend
├── frontend/
│   ├── node_modules/         # Dependencias de Node (ignorado por Git)
│   ├── public/               # Archivos estáticos
│   ├── src/
│   │   ├── components/       # Componentes de React (Dashboard, Charts, Alertas)
│   │   ├── App.jsx           # Componente raíz
│   │   └── main.jsx          # Punto de entrada de Vite
│   ├── package.json          # Dependencias y scripts de Node.js
│   ├── vite.config.js        # Configuración de empaquetado de Vite
│   └── .env                  # Variables de entorno públicas del frontend
└── README.md                 # Documentación completa del proyecto

Instalación Dependencias del Backend
cd backend

# En macOS / Linux:
./setup.sh

# En Windows:
.\setup.bat

Instalación del Front-End

npm run setup