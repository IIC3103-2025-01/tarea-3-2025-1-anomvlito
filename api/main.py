from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import requests
from bs4 import BeautifulSoup
from langchain.text_splitter import RecursiveCharacterTextSplitter
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import time  # Para un TTL simple en el caché (opcional)

# --- Modelos de Datos (Pydantic) ---


class ExplainRequest(BaseModel):
    url: HttpUrl
    question: str
    # Podríamos añadir un ID de sesión si quisiéramos conversaciones más complejas,
    # pero por ahora la URL del artículo servirá como clave de caché.


class ExplainResponse(BaseModel):
    best_chunk: str
    similarity_score: float
    llm_answer: str
    from_cache: bool = False  # Para saber si se usó el caché


# --- Configuración y Constantes ---
EMBEDDING_API_URL = "https://asteroide.ing.uc.cl/api/embed"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_API_URL = "https://asteroide.ing.uc.cl/api/generate"
LLM_MODEL = "integracion"
LLM_SYSTEM_INSTRUCTION = """Eres un asistente experto que procesa contenido parcial de wikipedia. Recibirás una instrucción con parte de artículos de wikipedia con el cual deberás responder preguntas sobre este. No uses información que sepas previamente del tema, sólo el contexto que te iré entregando. Responde las preguntas de forma asertiva, usando sólo la información provista."""

# --- Caché Simple en Memoria ---
# La clave será la URL del artículo (str)
# El valor será un diccionario: {"chunks": list[str], "embeddings": list[list[float]], "timestamp": float}
article_cache = {}
CACHE_TTL_SECONDS = 3600  # Tiempo de vida del caché en segundos (ej. 1 hora)

# --- Aplicación FastAPI ---
app = FastAPI(
    title="Wikipedia Explainer API con Caché",
    description="API para obtener explicaciones de Wikipedia, con caché de artículos procesados.",
    version="1.2.0"
)

# --- Configuración de CORS ---
origins = [
    "http://localhost:5173",  # Para desarrollo local, si aún lo necesitas
    "https://tarea-3-2025-1-anomvlito.onrender.com",  # <--- TU FRONTEND DESPLEGADO
    "https://tarea-3-2025-1-anomvlito-backend.onrender.com"  # Tu API, buena práctica
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Funciones de Lógica (scrape_wikipedia_content, split_text_into_chunks, get_embedding, get_llm_response) ---
# Estas funciones permanecen igual que en la versión anterior, asegúrate de tenerlas.
# Solo haré un pequeño ajuste en get_embedding para que sea más clara en caso de error de la API.


def scrape_wikipedia_content(url: str) -> str:
    # ... (código de scraping como lo teníamos)
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
    # ... (código de split_text_into_chunks como lo teníamos)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.split_text(text)


def get_embedding(text: str, attempt: int = 1, max_attempts: int = 3) -> list[float]:
    # ... (código de get_embedding con reintentos como lo teníamos)
    try:
        response = requests.post(EMBEDDING_API_URL, json={
                                 "model": EMBEDDING_MODEL, "input": text}, timeout=20)  # Timeout aumentado un poco
        response.raise_for_status()
        return response.json()["embeddings"][0]
    except requests.Timeout:
        if attempt < max_attempts:
            print(
                f"Timeout obteniendo embedding. Reintento {attempt+1}/{max_attempts} para: '{text[:30]}...'")
            time.sleep(0.5 * attempt)  # Espera exponencial simple
            return get_embedding(text, attempt + 1, max_attempts)
        else:
            print(
                f"Error: Timeout final obteniendo embedding para: '{text[:30]}...'")
            raise HTTPException(
                status_code=408, detail="Timeout después de varios reintentos con la API de Embeddings.")
    except requests.RequestException as e:
        error_detail = f"Error conectando con API de Embeddings: {e}"
        status_code_error = 503  # Default a 503
        if e.response is not None:
            error_detail += f" - Status: {e.response.status_code} - Body: {e.response.text}"
            status_code_error = e.response.status_code
        print(f"Error: {error_detail} para texto: '{text[:30]}...'")
        raise HTTPException(status_code=status_code_error, detail=error_detail)
    # TypeError si response.json() falla o no es subscriptable
    except (KeyError, IndexError, TypeError) as e:
        print(
            f"Error: Respuesta inesperada de API de Embeddings para texto: '{text[:30]}...'. Error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Respuesta inesperada de API de Embeddings: {e}")


def get_llm_response(context: str, question: str) -> str:
    # ... (código de get_llm_response como lo teníamos, con los 'options' para temperatura, etc.)
    prompt_llm = f"{LLM_SYSTEM_INSTRUCTION}\n\nContexto del artículo de Wikipedia:\n{context}\n\nPregunta del usuario:\n{question}\n\nRespuesta:"
    llm_options = {
        "temperature": 0.3,  # Temperatura más baja para respuestas más enfocadas
        "num_ctx": 512,
        "repeat_last_n": 10,
        "top_k": 18
    }
    try:
        response = requests.post(
            LLM_API_URL,
            json={
                "model": LLM_MODEL,
                "prompt": prompt_llm,
                "stream": False,
                "options": llm_options
            },
            timeout=120
        )
        response.raise_for_status()
        response_data = response.json()
        if "response" in response_data:
            return response_data["response"]
        else:
            raise HTTPException(
                status_code=500, detail=f"Respuesta inesperada del LLM API (campo 'response' no encontrado): {response_data}")
    except requests.Timeout:
        raise HTTPException(
            status_code=408, detail="Timeout esperando respuesta del LLM API.")
    except requests.RequestException as e:
        error_detail = f"Error al conectar con el LLM API: {e}"
        if e.response is not None:
            error_detail += f" - Status: {e.response.status_code} - Body: {e.response.text}"
        status_code = e.response.status_code if e.response is not None and e.response.status_code == 503 else 503
        raise HTTPException(status_code=status_code, detail=error_detail)
    except (KeyError, IndexError) as e:
        raise HTTPException(
            status_code=500, detail=f"Respuesta con formato incorrecto del LLM API: {e}")

# --- Endpoints de la API ---


@app.get("/")
def read_root():
    return {"message": "API funcionando con caché. Visita /docs para la documentación."}


@app.post("/explain", response_model=ExplainResponse)
# Hacemos la función async para poder usar await si fuera necesario con otras librerías
async def explain_article(request: ExplainRequest):
    article_url_str = str(request.url)
    from_cache_flag = False

    # Verificar si el artículo está en caché y si no ha expirado
    if article_url_str in article_cache and (time.time() - article_cache[article_url_str]["timestamp"] < CACHE_TTL_SECONDS):
        cached_data = article_cache[article_url_str]
        chunks = cached_data["chunks"]
        chunk_embeddings = cached_data["embeddings"]
        from_cache_flag = True
        print(f"Artículo {article_url_str} CARGADO DESDE CACHÉ.")
    else:
        print(
            f"Artículo {article_url_str} no en caché o expirado. PROCESANDO...")
        # 1. Scrape
        scraped_text = scrape_wikipedia_content(article_url_str)

        # 2. Chunking
        chunks = split_text_into_chunks(scraped_text)
        if not chunks:
            raise HTTPException(
                status_code=404, detail="No se pudo dividir el texto del artículo en chunks.")

        # 4. Embeddings de los Chunks
        processed_chunk_embeddings = []
        valid_chunks_for_processing = []
        for i, chunk_text in enumerate(chunks):
            try:
                # Llama a la función actualizada
                embedding = get_embedding(chunk_text)
                processed_chunk_embeddings.append(embedding)
                valid_chunks_for_processing.append(chunk_text)
            except HTTPException as e:
                # Si get_embedding lanza una excepción después de reintentos, aquí decidimos si continuar
                print(
                    f"ADVERTENCIA FINAL: No se pudo generar embedding para chunk {i} ('{chunk_text[:30]}...'). Detalle: {e.detail}. Saltando este chunk.")

        if not valid_chunks_for_processing or not processed_chunk_embeddings:
            raise HTTPException(
                status_code=500, detail="No se pudieron generar embeddings para ningún chunk del artículo.")

        # Guardar en caché los chunks que sí se pudieron procesar y sus embeddings
        article_cache[article_url_str] = {
            "chunks": valid_chunks_for_processing,
            "embeddings": processed_chunk_embeddings,
            "timestamp": time.time()
        }
        # Usar los datos recién procesados para la respuesta actual
        chunks = valid_chunks_for_processing
        chunk_embeddings = processed_chunk_embeddings
        print(
            f"Artículo {article_url_str} procesado y AÑADIDO/ACTUALIZADO EN CACHÉ.")

    # 3. Embedding de la Pregunta (siempre se hace, ya que la pregunta cambia)
    question_embedding = get_embedding(request.question)

    # 5. Cálculo de Similitud (con los embeddings del caché o recién generados)
    if not chunk_embeddings:  # Doble chequeo por si el caché estaba vacío o algo raro
        raise HTTPException(
            status_code=500, detail="No hay embeddings de chunks disponibles para calcular similitud.")

    similarities = cosine_similarity(
        np.array([question_embedding]),
        np.array(chunk_embeddings)
    )[0]

    # 6. Encontrar el Mejor Chunk
    most_relevant_chunk_index = np.argmax(similarities)
    best_chunk_text = chunks[most_relevant_chunk_index]
    best_similarity_score = float(similarities[most_relevant_chunk_index])

    # 7. Llamar al LLM
    llm_generated_answer = get_llm_response(
        context=best_chunk_text, question=request.question)

    return ExplainResponse(
        best_chunk=best_chunk_text,
        similarity_score=best_similarity_score,
        llm_answer=llm_generated_answer,
        from_cache=from_cache_flag  # Indicamos si se usó el caché
    )
