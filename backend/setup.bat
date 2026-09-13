@echo off
REM Instala las dependencias del backend. Uso: setup.bat (desde la carpeta backend\)
pip install -r requirements.txt
if not exist .env (
  copy .env.example .env
  echo Se creo backend\.env a partir de .env.example -- editalo con tus keys reales antes de correr la app.
)
echo Listo. Siguiente paso: python seed_data.py, luego uvicorn main:app --reload
