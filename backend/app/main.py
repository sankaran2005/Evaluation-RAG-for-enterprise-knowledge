import os
import uuid
import time
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_connection
from app.auth import (
    register_user, authenticate_user, create_access_token, decode_access_token
)
from app.document_processor import document_processor
from app.vector_store import vector_store
from app.llm_engine import llm_engine
from app.evaluator import evaluator
from app.sample_data import (
    SAMPLE_BENCHMARK_QUESTIONS, load_sample_documents, seed_sample_documents_if_needed
)

app = FastAPI(
    title="Evaluating RAG for Enterprise Knowledge API",
    description="Backend API for Enterprise Document RAG, Semantic Search, and Groundedness Evaluation",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sample documents if first run
@app.on_event("startup")
def startup_event():
    try:
        seed_sample_documents_if_needed()
    except Exception as e:
        print(f"Warning during startup seeding: {e}")

# Pydantic Schemas
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email_or_username: str
    password: str

class ChatRequest(BaseModel):
    question: str
    top_k: Optional[int] = None
    similarity_threshold: Optional[float] = None
    document_id: Optional[str] = None
    provider: Optional[str] = None

class CompareRequest(BaseModel):
    question: str
    provider: Optional[str] = None

class SettingsUpdateRequest(BaseModel):
    default_llm_provider: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_base_url: Optional[str] = None
    default_top_k: Optional[int] = None
    similarity_threshold: Optional[float] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None

# Optional Auth dependency
def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    return payload

# ----------------- Health & Summary -----------------
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "embedding_model": settings.EMBEDDING_MODEL,
        "active_llm_provider": settings.DEFAULT_LLM_PROVIDER,
        "total_indexed_chunks": len(vector_store.chunks_metadata)
    }

@app.get("/api/stats")
def get_system_stats():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as doc_count, COALESCE(SUM(file_size), 0) as total_bytes, COALESCE(SUM(chunk_count), 0) as total_chunks FROM documents")
    doc_stats = cursor.fetchone()

    cursor.execute("SELECT COUNT(*) as query_count, COALESCE(AVG(latency_ms), 0) as avg_latency, COALESCE(AVG(groundedness_score), 0) as avg_groundedness FROM chat_history")
    chat_stats = cursor.fetchone()

    cursor.execute("SELECT * FROM evaluation_runs ORDER BY id DESC LIMIT 1")
    latest_eval = cursor.fetchone()

    conn.close()

    eval_data = None
    if latest_eval:
        eval_data = {
            "avg_precision": latest_eval["avg_precision"],
            "avg_recall": latest_eval["avg_recall"],
            "avg_f1": latest_eval["avg_f1"],
            "avg_mrr": latest_eval["avg_mrr"],
            "avg_groundedness": latest_eval["avg_groundedness"],
            "hallucination_reduction_pct": round(max(0.0, (1.0 - latest_eval["avg_hallucination_rate"]) * 100), 1),
            "total_questions": latest_eval["total_questions"]
        }

    return {
        "documents": {
            "count": doc_stats["doc_count"],
            "total_size_mb": round(doc_stats["total_bytes"] / (1024 * 1024), 2),
            "chunks_count": doc_stats["total_chunks"] or len(vector_store.chunks_metadata)
        },
        "chat": {
            "total_queries": chat_stats["query_count"],
            "avg_latency_ms": round(chat_stats["avg_latency"], 2),
            "avg_groundedness_score": round(chat_stats["avg_groundedness"], 4)
        },
        "evaluation": eval_data,
        "vector_store": {
            "total_chunks_in_memory": len(vector_store.chunks_metadata),
            "embedding_dimension": vector_store.dimension
        }
    }

# ----------------- Authentication -----------------
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    try:
        user = register_user(req.username, req.email, req.password)
        token = create_access_token({"sub": user["email"], "username": user["username"], "role": user["role"]})
        return {"access_token": token, "token_type": "bearer", "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = authenticate_user(req.email_or_username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")
    token = create_access_token({"sub": user["email"], "username": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/api/auth/me")
def get_me(user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    if not user:
        # Return guest demo profile
        return {"username": "demo_user", "email": "demo@enterprise.ai", "role": "admin"}
    return {"username": user.get("username"), "email": user.get("sub"), "role": user.get("role")}

# ----------------- Document Management -----------------
@app.get("/api/documents")
def list_documents():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
    docs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"documents": docs, "total": len(docs)}

@app.post("/api/documents/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    results = []
    conn = get_connection()
    cursor = conn.cursor()

    for file in files:
        filename = file.filename
        ext = Path(filename).suffix.lower()
        if ext not in [".pdf", ".docx", ".doc", ".txt", ".md"]:
            continue

        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        save_path = settings.UPLOADS_DIR / f"{doc_id}_{filename}"

        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)

        file_size = len(content)

        try:
            chunks = document_processor.process_file(
                file_path=save_path,
                doc_id=doc_id,
                original_filename=filename,
                chunk_size=settings.CHUNK_SIZE,
                chunk_overlap=settings.CHUNK_OVERLAP
            )

            vector_store.add_documents(chunks)

            cursor.execute(
                "INSERT INTO documents (id, filename, file_type, file_size, chunk_count, uploaded_by, status) VALUES (?, ?, ?, ?, ?, 'user', 'indexed')",
                (doc_id, filename, ext.replace(".", "").upper(), file_size, len(chunks))
            )

            results.append({
                "id": doc_id,
                "filename": filename,
                "file_size": file_size,
                "chunk_count": len(chunks),
                "status": "success"
            })
        except Exception as e:
            results.append({
                "id": doc_id,
                "filename": filename,
                "status": "error",
                "error": str(e)
            })

    conn.commit()
    conn.close()
    return {"uploaded": results}

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT filename FROM documents WHERE id = ?", (doc_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    vector_store.delete_document(doc_id)
    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

    return {"message": "Document deleted and vector index updated successfully", "document_id": doc_id}

@app.get("/api/documents/{doc_id}/chunks")
def get_document_chunks(doc_id: str):
    chunks = vector_store.get_chunks_by_document(doc_id)
    return {"document_id": doc_id, "chunk_count": len(chunks), "chunks": chunks}

@app.post("/api/documents/load-samples")
def trigger_load_samples():
    docs = load_sample_documents()
    return {"message": "Pre-packaged enterprise sample documents loaded and indexed.", "documents": docs}

# ----------------- Chat & QA -----------------
@app.post("/api/chat")
def chat_query(req: ChatRequest):
    top_k = req.top_k or settings.DEFAULT_TOP_K
    threshold = req.similarity_threshold if req.similarity_threshold is not None else settings.SIMILARITY_THRESHOLD

    # 1. Search vector store
    search_start = time.time()
    retrieved_chunks = vector_store.search(req.question, top_k=top_k, threshold=threshold)
    
    # Filter by specific document if requested
    if req.document_id:
        retrieved_chunks = [c for c in retrieved_chunks if c.get("document_id") == req.document_id]

    search_time_ms = round((time.time() - search_start) * 1000, 2)

    # 2. Generate answer
    rag_result = llm_engine.generate_rag_answer(
        question=req.question,
        context_chunks=retrieved_chunks,
        provider=req.provider
    )

    total_latency_ms = round(search_time_ms + rag_result["latency_ms"], 2)

    # 3. Save to chat history
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO chat_history (question, answer, citations_json, model_used, latency_ms, groundedness_score)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            req.question,
            rag_result["answer"],
            json.dumps(rag_result["citations"]),
            rag_result["model_used"],
            total_latency_ms,
            rag_result["groundedness_score"]
        ))
        conn.commit()
        conn.close()
    except Exception:
        pass

    return {
        "question": req.question,
        "answer": rag_result["answer"],
        "citations": rag_result["citations"],
        "groundedness_score": rag_result["groundedness_score"],
        "hallucination_rate": rag_result["hallucination_rate"],
        "search_time_ms": search_time_ms,
        "generation_time_ms": rag_result["latency_ms"],
        "total_latency_ms": total_latency_ms,
        "retrieved_chunks": retrieved_chunks,
        "model_used": rag_result["model_used"]
    }

@app.get("/api/chat/history")
def get_chat_history(limit: int = 50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_history ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    history = []
    for r in rows:
        item = dict(r)
        item["citations"] = json.loads(item.get("citations_json", "[]"))
        history.append(item)
    conn.close()
    return {"history": history}

@app.delete("/api/chat/history")
def clear_chat_history():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history")
    conn.commit()
    conn.close()
    return {"message": "Chat history cleared successfully"}

# ----------------- Side-by-Side Comparison -----------------
@app.post("/api/chat/compare")
def compare_answers(req: CompareRequest):
    top_k = settings.DEFAULT_TOP_K
    retrieved_chunks = vector_store.search(req.question, top_k=top_k)

    rag_res = llm_engine.generate_rag_answer(req.question, retrieved_chunks, provider=req.provider)
    basic_res = llm_engine.generate_basic_answer(req.question, provider=req.provider)

    return {
        "question": req.question,
        "rag": {
            "answer": rag_res["answer"],
            "citations": rag_res["citations"],
            "groundedness_score": rag_res["groundedness_score"],
            "hallucination_rate": rag_res["hallucination_rate"],
            "latency_ms": rag_res["latency_ms"],
            "retrieved_chunks_count": len(retrieved_chunks)
        },
        "basic_llm": {
            "answer": basic_res["answer"],
            "citations": [],
            "groundedness_score": 0.0,
            "hallucination_rate": 1.0,
            "latency_ms": basic_res["latency_ms"]
        },
        "retrieved_passages": retrieved_chunks
    }

# ----------------- Evaluation Studio -----------------
@app.get("/api/evaluation/benchmark")
def get_benchmark_questions():
    return {"benchmark_questions": SAMPLE_BENCHMARK_QUESTIONS}

@app.post("/api/evaluation/run")
def run_evaluation_benchmark(top_k: int = 4):
    report = evaluator.run_benchmark(SAMPLE_BENCHMARK_QUESTIONS, top_k=top_k)
    return report

@app.get("/api/evaluation/runs")
def get_evaluation_runs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, run_name, total_questions, avg_precision, avg_recall, avg_f1, avg_mrr, avg_groundedness, avg_hallucination_rate, avg_latency_ms, created_at FROM evaluation_runs ORDER BY id DESC LIMIT 10")
    runs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"runs": runs}

# ----------------- Settings -----------------
@app.get("/api/settings")
def get_app_settings():
    return {
        "default_llm_provider": settings.DEFAULT_LLM_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL,
        "default_top_k": settings.DEFAULT_TOP_K,
        "similarity_threshold": settings.SIMILARITY_THRESHOLD,
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP,
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "ollama_base_url": settings.OLLAMA_BASE_URL
    }

@app.post("/api/settings")
def update_app_settings(req: SettingsUpdateRequest):
    if req.default_llm_provider:
        settings.DEFAULT_LLM_PROVIDER = req.default_llm_provider
    if req.gemini_api_key is not None:
        settings.GEMINI_API_KEY = req.gemini_api_key
    if req.openai_api_key is not None:
        settings.OPENAI_API_KEY = req.openai_api_key
    if req.anthropic_api_key is not None:
        settings.ANTHROPIC_API_KEY = req.anthropic_api_key
    if req.ollama_base_url:
        settings.OLLAMA_BASE_URL = req.ollama_base_url
    if req.default_top_k is not None:
        settings.DEFAULT_TOP_K = req.default_top_k
    if req.similarity_threshold is not None:
        settings.SIMILARITY_THRESHOLD = req.similarity_threshold
    if req.chunk_size is not None:
        settings.CHUNK_SIZE = req.chunk_size
    if req.chunk_overlap is not None:
        settings.CHUNK_OVERLAP = req.chunk_overlap

    return {"message": "Settings updated successfully", "current": get_app_settings()}
