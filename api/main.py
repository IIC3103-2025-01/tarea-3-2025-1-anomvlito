from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import requests
from bs4 import BeautifulSoup
from langchain.text_splitter import RecursiveCharacterTextSplitter
import numpy as np
import time
import re
import chromadb

# --- Modelos de Datos (Pydantic) ---


class ExplainRequest(BaseModel):
    url: HttpUrl
    question: str


class ExplainResponse(BaseModel):
    best_chunk: str
    similarity_score: float
    llm_answer: str
    from_cache: bool = False


# --- Configuración y Constantes ---
EMBEDDING_API_URL = "https://asteroide.ing.uc.cl/api/embed"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_API_URL = "https://asteroide.ing.uc.cl/api/generate"
LLM_MODEL = "integracion"
LLM_SYSTEM_INSTRUCTION = """Eres un asistente experto que procesa contenido parcial de wikipedia. Recibirás una instrucción con parte de artículos de wikipedia con el cual deberás responder preguntas sobre este. No uses información que sepas previamente del tema, sólo el contexto que te iré entregando. Responde las preguntas de forma asertiva, usando sólo la información provista."""

SIMILARITY_THRESHOLD = 0.25

# --- Cliente de ChromaDB en Memoria ---
# Este cliente gestionará nuestras colecciones vectoriales en memoria.
# Los datos se perderán si el servidor se reinicia.
chroma_client = chromadb.Client()

# --- Aplicación FastAPI ---
app = FastAPI(
    title="Wikipedia Explainer API",
    description="API para obtener explicaciones de Wikipedia.",
    version="1.2.0"
)

# --- Configuración de CORS ---
origins = [
    "http://localhost:5173",
    "https://tarea-3-2025-1-anomvlito.onrender.com",
    "https://tarea-3-2025-1-anomvlito-backend.onrender.com"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Funciones de Lógica ---


def scrape_wikipedia_content(url: str) -> str:
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        content_div = soup.find(id='mw-content-text')
        if not content_div:
            raise ValueError(
                "No se pudo encontrar el contenido principal del artículo.")
        paragraphs = content_div.find_all('p')
        article_text = "\n".join([p.get_text() for p in paragraphs])
        if not article_text.strip():
            raise ValueError(
                "El contenido principal extraído del artículo está vacío.")
        return article_text
    except requests.RequestException as e:
        raise HTTPException(
            status_code=400, detail=f"Error al acceder a la URL: {e}")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


def split_text_into_chunks(text: str):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        length_function=len
    )
    return text_splitter.split_text(text)


def get_embedding(text: str, attempt: int = 1, max_attempts: int = 3) -> list[float]:
    try:
        response = requests.post(EMBEDDING_API_URL, json={
                                 "model": EMBEDDING_MODEL, "input": text}, timeout=20)
        response.raise_for_status()
        return response.json()["embeddings"][0]
    except requests.Timeout:
        if attempt < max_attempts:
            print(
                f"Timeout obteniendo embedding. Reintento {attempt+1}/{max_attempts} para: '{text[:30]}...'")
            time.sleep(0.5 * attempt)
            return get_embedding(text, attempt + 1, max_attempts)
        else:
            raise HTTPException(
                status_code=408, detail="Timeout después de varios reintentos con la API de Embeddings.")
    except requests.RequestException as e:
        error_detail = f"Error conectando con API de Embeddings: {e}"
        if e.response is not None:
            error_detail += f" - Status: {e.response.status_code} - Body: {e.response.text}"
        raise HTTPException(
            status_code=e.response.status_code if e.response is not None else 503, detail=error_detail)
    except (KeyError, IndexError, TypeError) as e:
        raise HTTPException(
            status_code=500, detail=f"Respuesta inesperada de API de Embeddings: {e}")


def get_llm_response(context: str, question: str) -> str:
    prompt_llm = f"{LLM_SYSTEM_INSTRUCTION}\n\nContexto del artículo de Wikipedia:\n{context}\n\nPregunta del usuario:\n{question}\n\nRespuesta:"
    llm_options = {"temperature": 0.3, "num_ctx": 512,
                   "repeat_last_n": 10, "top_k": 18}
    try:
        response = requests.post(LLM_API_URL, json={
                                 "model": LLM_MODEL, "prompt": prompt_llm, "stream": False, "options": llm_options}, timeout=120)
        response.raise_for_status()
        response_data = response.json()
        if "response" in response_data:
            return response_data["response"]
        else:
            raise HTTPException(
                status_code=500, detail=f"Respuesta inesperada del LLM API (campo 'response' no encontrado): {response_data}")
    except requests.RequestException as e:
        error_detail = f"Error al conectar con el LLM API: {e}"
        if e.response is not None:
            error_detail += f" - Status: {e.response.status_code} - Body: {e.response.text}"
        raise HTTPException(
            status_code=e.response.status_code if e.response is not None else 503, detail=error_detail)
    except (KeyError, IndexError, TypeError) as e:
        raise HTTPException(
            status_code=500, detail=f"Respuesta con formato incorrecto del LLM API: {e}")

# --- Endpoints de la API ---


@app.get("/")
def read_root():
    return {"message": "API funcionando con ChromaDB. Visita /docs para la documentación."}


@app.post("/explain", response_model=ExplainResponse)
async def explain_article(request: ExplainRequest):
    """
    Procesa un artículo de Wikipedia y una pregunta para generar una explicación.
    Utiliza un umbral de similitud para evitar llamar al LLM con contexto irrelevante.
    """
    def sanitize_collection_name(url: str) -> str:
        # Sanitiza la URL para usarla como un nombre de colección válido en ChromaDB.
        name = re.sub(r'[^a-zA-Z0-9_-]', '', url)
        name = name[:60]
        if len(name) < 3:
            name = name + 'x' * (3 - len(name))
        return name

    article_url_str = str(request.url)
    collection_name = sanitize_collection_name(article_url_str)

    # Usa get_or_create_collection para manejar la creación y obtención de forma segura.
    collection = chroma_client.get_or_create_collection(name=collection_name)

    # Verifica si la colección está vacía para decidir si se procesa o se usa la caché.
    if collection.count() == 0:
        from_cache_flag = False
        print(
            f"Colección '{collection_name}' está vacía. Procesando y poblando...")

        # Proceso de scraping, chunking y embedding del artículo.
        scraped_text = scrape_wikipedia_content(article_url_str)
        chunks = split_text_into_chunks(scraped_text)
        if not chunks:
            raise HTTPException(
                status_code=404, detail="No se pudo dividir el texto en chunks.")

        valid_chunks = [chunk for chunk in chunks if chunk.strip()]
        if not valid_chunks:
            raise HTTPException(
                status_code=500, detail="El contenido del artículo no generó chunks válidos.")

        chunk_embeddings = [get_embedding(chunk) for chunk in valid_chunks]

        # Añadir los datos a la colección.
        collection.add(
            embeddings=chunk_embeddings,
            documents=valid_chunks,
            ids=[f"chunk_{i}" for i in range(len(valid_chunks))]
        )
        print(
            f"Colección '{collection_name}' poblada con {len(valid_chunks)} chunks.")
    else:
        from_cache_flag = True
        print(
            f"Colección '{collection_name}' ya existe y tiene datos. Usando caché.")

    # Obtener embedding para la pregunta del usuario.
    question_embedding = get_embedding(request.question)

    # Consultar a la base de datos vectorial para encontrar el chunk más relevante.
    query_results = collection.query(
        query_embeddings=[question_embedding],
        n_results=1
    )

    if not query_results or not query_results.get('documents') or not query_results['documents'][0]:
        raise HTTPException(
            status_code=500, detail="La consulta a la base de datos vectorial no devolvió resultados.")

    best_chunk_text = query_results['documents'][0][0]
    # La distancia es una medida de diferencia (menor es mejor). La convertimos a similitud (mayor es mejor).
    similarity_score = 1 - query_results['distances'][0][0]

    # --- INICIO DE LA LÓGICA MODIFICADA ---

    # 1. Comparamos el puntaje de similitud con nuestro umbral predefinido.
    if similarity_score < SIMILARITY_THRESHOLD:

        # Si la similitud es muy baja, no llamamos al LLM.
        print(
            f"Similitud baja ({similarity_score:.2f}) detectada, por debajo del umbral ({SIMILARITY_THRESHOLD}). Saltando llamada al LLM.")

        # 2. Creamos el mensaje predefinido que se enviará al frontend.
        predefined_answer = "Favor necesitamos un poco más de contexto en tu pregunta, ya que no queremos entregarte una respuesta que haga al LLM alucinar."

        # 3. Devolvemos una respuesta con el mensaje especial.
        return ExplainResponse(
            best_chunk=best_chunk_text,
            similarity_score=similarity_score,
            llm_answer=predefined_answer,
            from_cache=from_cache_flag
        )
    else:
        # Si la similitud es suficientemente alta, el flujo continúa como siempre.
        print(
            f"Similitud alta ({similarity_score:.2f}) detectada. Llamando al LLM...")

        # 4. Llamamos al LLM para que genere la respuesta.
        llm_generated_answer = get_llm_response(
            context=best_chunk_text, question=request.question)

        return ExplainResponse(
            best_chunk=best_chunk_text,
            similarity_score=similarity_score,
            llm_answer=llm_generated_answer,
            from_cache=from_cache_flag
        )
    # --- FIN DE LA LÓGICA MODIFICADA ---
