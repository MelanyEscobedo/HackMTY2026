from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="HackMTY API")

# Habilitar CORS para que tu React en localhost:5173 pueda consumir esta API sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En hackathons permitimos todos para evitar problemas de conexión
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend FastAPI listo"}