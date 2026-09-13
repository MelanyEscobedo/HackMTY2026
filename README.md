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

```
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
```

## Instalación Dependencias del Backend
```
cd backend
```
macOS / Linux:
```
./setup.sh
```
Windows:
```
.\setup.bat
```

Esto instala las dependencias de Python y crea `backend/.env` (copiado de
`.env.example`) si todavía no existe. Ábrelo y pega tus keys reales:

```
NESSIE_API_KEY=...          # Nessie sandbox de Capital One
GOOGLE_API_KEY=...          # gratis, sin tarjeta -- aistudio.google.com/apikey
ELEVENLABS_API_KEY=...      # elevenlabs.io
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # opcional, ya trae un valor por default
```

`backend/.env` nunca se sube a GitHub (está en `.gitignore`) -- cada quien
del equipo usa sus propias keys localmente.

## Instalación del Front-End
- Es necesario tener instalado node.js para usar npm, si no lo tienes, instálalo. 
```
cd frontend
npm run setup
```

## Correr el backend, paso a paso

```
cd backend
python seed_data.py       # crea la clienta de prueba "Maria Hopper" + su historial (necesita NESSIE_API_KEY)
uvicorn main:app --reload
```

Con eso corriendo en `http://localhost:8000`:

- El frontend de React (`npm run dev` en `frontend/`, puerto 5173) es la
  interfaz principal -- CORS está abierto para que consuma la API.
- `http://localhost:8000/docs` tiene documentación interactiva de todos los
  endpoints.

### Endpoints principales

- `GET /demo-account` — cuenta, saldo y estado de congelado de la clienta demo.
- `GET /accounts/{id}/purchases` — sus compras, con categoría de cada una.
- `GET /accounts/{id}/risk` — puntaje de riesgo de fraude + explicación.
- `GET /accounts/{id}/spending-breakdown` — gasto por categoría.
- `GET /accounts/{id}/leaks` — cargos recurrentes (posibles suscripciones).
- `POST /accounts/{id}/freeze` — congela/descongela la tarjeta (simulado).
- `POST /chat/message` `{"message": "..."}` — un turno del asistente (Gemini).
- `POST /chat/speak` `{"text": "..."}` — convierte texto a audio real (ElevenLabs).

### Si `api.nessieisreal.com` no conecta

Algunas redes (wifis de campus/eventos) bloquean el tráfico HTTP plano que
usa Nessie. Si `python seed_data.py` o el backend fallan con
`ConnectionError` / `connection refused` / `timed out`, no es un bug del
código -- prueba con otra red, o revisa con los organizadores del hackathon
si tienen una red recomendada para esto.