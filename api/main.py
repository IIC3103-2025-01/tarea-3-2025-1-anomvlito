from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <--- IMPORTA ESTO
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

class ExplainResponse(BaseModel): # <--- MODIFICADO
    best_chunk: str
    similarity_score: float
    llm_answer: str # Para la respuesta generada por el LLM

# --- Configuración y Constantes ---
EMBEDDING_API_URL = "https://asteroide.ing.uc.cl/api/embed"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_API_URL = "https://asteroide.ing.uc.cl/api/generate" # <--- URL DEL LLM
LLM_MODEL = "integracion" # <--- MODELO DEL LLM

LLM_SYSTEM_INSTRUCTION = """Eres un asistente experto que procesa contenido parcial de wikipedia. Recibirás una instrucción con parte de artículos de wikipedia con el cual deberás responder preguntas sobre este. No uses información que sepas previamente del tema, sólo el contexto que te iré entregando. Responde las preguntas de forma asertiva, usando sólo la información provista.""" # <--- INSTRUCCIÓN DEL SISTEMA


# --- Aplicación FastAPI ---
app = FastAPI(
    title="Wikipedia Explainer API - Embedding Focus",
    description="API para obtener el chunk más relevante de Wikipedia usando embeddings.",
    version="1.1.0" # Incrementamos versión para reflejar el foco actual
)


# --- CONFIGURACIÓN DE CORS --- <--- AÑADE ESTAS LÍNEAS
origins = [
    "http://localhost",         # Origen base
    "http://localhost:5173",    # Tu frontend de Vite
    # Podrías añadir más orígenes si despliegas tu frontend en otro lugar
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Lista de orígenes permitidos (puedes usar ["*"] para permitir todos)
    allow_credentials=True, # Permite cookies (no relevante para ti ahora, pero es común)
    allow_methods=["*"],    # Permite todos los métodos (GET, POST, etc.)
    allow_headers=["*"],    # Permite todas las cabeceras
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

# ... (después de get_embedding)

def get_llm_response(context: str, question: str) -> str:
    """
    Obtiene una respuesta del LLM usando el contexto y la pregunta.
    """
    prompt_llm = f"{LLM_SYSTEM_INSTRUCTION}\n\nContexto del artículo de Wikipedia:\n{context}\n\nPregunta del usuario:\n{question}\n\nRespuesta:"

    try:
        response = requests.post(
            LLM_API_URL,
            json={
                "model": LLM_MODEL,
                "prompt": prompt_llm,
                "stream": False
            },
            timeout=120 # Tiempo de espera máximo de 2 minutos como dice el enunciado
        )
        response.raise_for_status() 
        
        response_data = response.json()
        
        # El endpoint /api/generate devuelve la respuesta en el campo "response"
        if "response" in response_data:
            return response_data["response"]
        else:
            raise HTTPException(status_code=500, detail=f"Respuesta inesperada del LLM API (campo 'response' no encontrado): {response_data}")

    except requests.Timeout:
        raise HTTPException(status_code=408, detail="Timeout esperando respuesta del LLM API.")
    except requests.RequestException as e:
        error_detail = f"Error al conectar con el LLM API: {e}"
        if e.response is not None:
            error_detail += f" - Status: {e.response.status_code} - Body: {e.response.text}"
        # El enunciado menciona manejar errores 503
        status_code = e.response.status_code if e.response is not None and e.response.status_code == 503 else 503
        raise HTTPException(status_code=status_code, detail=error_detail)
    except (KeyError, IndexError) as e:
         raise HTTPException(status_code=500, detail=f"Respuesta con formato incorrecto del LLM API: {e}")

# --- Endpoints de la API ---

@app.get("/")
def read_root():
    return {"message": "API funcionando (foco en Embeddings). Visita /docs para la documentación."}

# ... (endpoint @app.get("/"))

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
    valid_chunks = [] 
    for i, chunk_text in enumerate(chunks):
        try:
            embedding = get_embedding(chunk_text)
            chunk_embeddings.append(embedding)
            valid_chunks.append(chunk_text)
        except HTTPException as e:
            print(f"Advertencia: No se pudo generar embedding para el chunk {i} ('{chunk_text[:30]}...'): {e.detail}. Saltando.")
    
    if not valid_chunks or not chunk_embeddings:
        raise HTTPException(status_code=500, detail="No se pudieron generar embeddings para los chunks del artículo.")

    # 5. Cálculo de Similitud
    similarities = cosine_similarity(
        np.array([question_embedding]),
        np.array(chunk_embeddings)
    )[0]

    # 6. Encontrar el Mejor Chunk
    most_relevant_chunk_index = np.argmax(similarities)
    best_chunk_text = valid_chunks[most_relevant_chunk_index] 
    best_similarity_score = float(similarities[most_relevant_chunk_index])

    # 7. Llamar al LLM con el mejor chunk y la pregunta  <--- MODIFICACIÓN AQUÍ
    llm_generated_answer = get_llm_response(context=best_chunk_text, question=request.question)

    return ExplainResponse(
        best_chunk=best_chunk_text,
        similarity_score=best_similarity_score,
        llm_answer=llm_generated_answer # <--- NUEVO CAMPO EN LA RESPUESTA
    )