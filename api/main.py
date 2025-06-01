from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl
import requests
from bs4 import BeautifulSoup


# --- Modelos de Datos (Pydantic) ---
# Definen la estructura de los datos que nuestra API espera recibir y enviar.

class ExplainRequest(BaseModel):
    """Modelo para la solicitud que recibirá el endpoint /explain."""
    url: HttpUrl  # FastAPI validará automáticamente que es una URL válida.
    question: str

class ExplainResponse(BaseModel):
    """Modelo para la respuesta que enviará el endpoint /explain."""
    scraped_text_preview: str
    # Más adelante añadiremos aquí la respuesta del LLM.

# --- Aplicación FastAPI ---
app = FastAPI(
    title="Wikipedia Explainer API",
    description="API para obtener explicaciones de artículos de Wikipedia usando RAG.",
    version="1.0.0"
)

# --- Funciones de Lógica ---
def scrape_wikipedia_content(url: str) -> str:
    """
    Realiza scraping del contenido principal de un artículo de Wikipedia.
    """
    try:
        response = requests.get(url)
        # Lanza un error si la petición no fue exitosa (ej. 404)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # El contenido principal de los artículos de Wikipedia está dentro de este div
        content_div = soup.find(id='mw-content-text')

        if not content_div:
            return "No se pudo encontrar el contenido principal del artículo."

        # Extraemos solo el texto de los párrafos <p> para limpiarlo
        paragraphs = content_div.find_all('p')
        article_text = "\n".join([p.get_text() for p in paragraphs])

        return article_text

    except requests.RequestException as e:
        # Maneja errores de red (ej. no se puede conectar)
        return f"Error al acceder a la URL: {e}"


# --- Endpoints de la API ---

@app.get("/")
def read_root():
    """Endpoint raíz para verificar que el servidor está funcionando."""
    return {"message": "API funcionando. Visita /docs para ver la documentación."}

@app.post("/explain", response_model=ExplainResponse)
def explain_article(request: ExplainRequest):
    """
    Recibe una URL de Wikipedia y una pregunta, hace scraping del artículo
    y (eventualmente) devuelve una explicación generada por un LLM.
    """
    # 1. Realizar el scraping del contenido de la URL
    scraped_text = scrape_wikipedia_content(str(request.url))

    # 2. Por ahora, solo devolvemos un preview del texto obtenido
    # En los siguientes pasos, aquí irá la lógica de RAG y el LLM.
    preview = scraped_text[:500] + "..." if len(scraped_text) > 500 else scraped_text

    return ExplainResponse(scraped_text_preview=preview)