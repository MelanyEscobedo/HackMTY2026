#!/usr/bin/env bash
# Instala las dependencias del backend. Uso: ./setup.sh (desde la carpeta backend/)
set -e
pip install -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó backend/.env a partir de .env.example -- edítalo con tus keys reales antes de correr la app."
fi
echo "Listo. Siguiente paso: python seed_data.py, luego uvicorn main:app --reload"
