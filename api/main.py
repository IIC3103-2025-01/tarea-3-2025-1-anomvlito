from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
import requests
from bs4 import BeautifulSoup
from langchain.text_splitter import RecursiveCharacterTextSplitter
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# --- Modelos de Datos (Pydantic) ---
class ExplainRequest(BaseModel):
    url: HttpUrl
    question: str

class ExplainResponse(BaseModel):
    best_chunk: str
    similarity_score: float # Para verificar qué tan relevante fue el chunk

# --- Configuración y Constantes ---
EMBEDDING_API_URL = "https://asteroide.ing.uc.cl/api/embed"
EMBEDDING_MODEL = "nomic-embed-text"
# LLM_API_URL = "https://asteroide.ing.uc.cl/api/generate" # Lo usaremos después
# LLM_MODEL = "integracion" # Lo usaremos después
# LLM_SYSTEM_INSTRUCTION = """Eres un asistente experto...""" # Lo usaremos después


# --- Aplicación FastAPI ---
app = FastAPI(
    title="Wikipedia Explainer API - Embedding Focus",
    description="API para obtener el chunk más relevante de Wikipedia usando embeddings.",
    version="1.1.0" # Incrementamos versión para reflejar el foco actual
)

# --- Funciones de Lógica ---

def scrape_wikipedia_content(url: str) -> str:
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        content_div = soup.find(id='mw-content-text')
        if not content_div:
            raise ValueError("No se pudo encontrar el contenido principal del artículo.")
        paragraphs = content_div.find_all('p')
        article_text = "\n".join([p.get_text() for p in paragraphs])
        if not article_text.strip(): # Verificar si el texto extraído no está vacío
             raise ValueError("El contenido principal extraído del artículo está vacío.")
        return article_text
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Error al acceder a la URL: {e}")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

def split_text_into_chunks(text: str):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.split_text(text)

def get_embedding(text: str, attempt: int = 1, max_attempts: int = 3) -> list[float]:
    """Obtiene el embedding para un texto, con reintentos simples."""
    try:
        response = requests.post(EMBEDDING_API_URL, json={"model": EMBEDDING_MODEL, "input": text}, timeout=10) # Timeout de 10s
        response.raise_for_status()
        return response.json()["embeddings"][0]
    except requests.Timeout:
        if attempt < max_attempts:
            print(f"Timeout obteniendo embedding para: '{text[:50]}...'. Reintento {attempt+1}/{max_attempts}")
            return get_embedding(text, attempt + 1, max_attempts)
        else:
            raise HTTPException(status_code=408, detail="Timeout después de varios reintentos con la API de Embeddings.")
    except requests.RequestException as e:
        error_detail = f"Error conectando con API de Embeddings: {e}"
        if e.response is not None:
            error_detail += f" - Status: {e.response.status_code} - Body: {e.response.text}"
        raise HTTPException(status_code=503, detail=error_detail)
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Respuesta inesperada de API de Embeddings: {e}")


# --- Endpoints de la API ---

@app.get("/")
def read_root():
    return {"message": "API funcionando (foco en Embeddings). Visita /docs para la documentación."}

@app.post("/explain", response_model=ExplainResponse)
def explain_article(request: ExplainRequest):
    # 1. Scrape
    scraped_text = scrape_wikipedia_content(str(request.url))

    # 2. Chunking
    chunks = split_text_into_chunks(scraped_text)
    if not chunks:
        raise HTTPException(status_code=404, detail="No se pudo dividir el texto del artículo en chunks.")

    # 3. Embedding de la Pregunta
    question_embedding = get_embedding(request.question)

    # 4. Embeddings de los Chunks
    chunk_embeddings = []
    valid_chunks = [] # Mantenemos solo los chunks para los que obtuvimos embedding
    for i, chunk_text in enumerate(chunks):
        try:
            embedding = get_embedding(chunk_text)
            chunk_embeddings.append(embedding)
            valid_chunks.append(chunk_text)
        except HTTPException as e:
            print(f"Advertencia: No se pudo generar embedding para el chunk {i} ('{chunk_text[:30]}...'): {e.detail}. Saltando.")
    
    if not valid_chunks or not chunk_embeddings: # Si ningún chunk pudo ser procesado
        raise HTTPException(status_code=500, detail="No se pudieron generar embeddings para los chunks del artículo.")

    # 5. Cálculo de Similitud
    similarities = cosine_similarity(
        np.array([question_embedding]),
        np.array(chunk_embeddings)
    )[0]

    # 6. Encontrar el Mejor Chunk
    most_relevant_chunk_index = np.argmax(similarities)
    best_chunk_text = valid_chunks[most_relevant_chunk_index] # Usamos valid_chunks
    best_similarity_score = float(similarities[most_relevant_chunk_index])

    # 7. Devolver el mejor chunk y su similitud (sin LLM por ahora)
    return ExplainResponse(
        best_chunk=best_chunk_text,
        similarity_score=best_similarity_score
    )