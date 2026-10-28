FROM python:3.12-slim

# No generar .pyc y enviar los logs directamente a la salida estándar.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencias primero (aprovecha la caché de capas de Docker).
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Usuario sin privilegios.
RUN useradd --create-home --uid 1000 appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Aplica las migraciones pendientes y luego inicia la API.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
