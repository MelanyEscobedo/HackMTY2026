#!/bin/bash
echo "Configurando entorno virtual en Unix/macOS..."

python3 -m venv venv || python -m venv venv

if [ ! -d "venv" ]; then
    echo "Error: No se pudo crear venv. Asegúrate de tener python3 y python3-venv instalados."
    exit 1
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "Entorno listo. Para activarlo usa: source venv/bin/activate"