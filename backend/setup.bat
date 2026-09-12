@echo off
echo Configurando entorno virtual en Windows...

REM Intenta primero con 'py', si no con 'python'
py -m venv venv 2>nul || python -m venv venv

if not exist "venv\Scripts\activate.bat" (
    echo Error: No se pudo crear la carpeta venv. Verifica la instalacion de Python.
    exit /b 1
)

echo Activando venv e instalando dependencias...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

echo Entorno listo. Para activarlo usa: venv\Scripts\activate.bat
pause