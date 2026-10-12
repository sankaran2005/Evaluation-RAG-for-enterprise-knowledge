import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
from app.config import settings

logger = logging.getLogger("rag.vector_store")

class EnterpriseVectorEmbedder:
    """
    Robust enterprise semantic & lexical vector embedder.
    Combines sublinear TF-IDF, character and word boundary tokens, and cosine normalization.
    """
    def __init__(self):
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.vectorizer = TfidfVectorizer(
            stop_words='english',
            token_pattern=r'(?u)\b[\w\(\)\-\.]+\b',
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=4096
        )
        self.fitted = False

    def fit_corpus(self, texts: List[str]):
        if not texts:
            return
        self.vectorizer.fit(texts)
        self.fitted = True

    def transform(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, 4096), dtype=np.float32)
        if not self.fitted:
            self.fit_corpus(texts)
        
        matrix = self.vectorizer.transform(texts).toarray().astype(np.float32)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1e-10
        return matrix / norms

class VectorStoreManager:
    def __init__(self):
        self.index = None
        self.chunks_metadata: List[Dict[str, Any]] = []
        self.embedder = EnterpriseVectorEmbedder()
        self.dimension = 4096
        self.index_file = settings.VECTOR_DIR / "faiss.index"
        self.meta_file = settings.VECTOR_DIR / "chunks_metadata.json"
        self.load_from_disk()

    def _rebuild_index(self):
        """Fit embedder on all chunk texts and rebuild the FAISS index."""
        if not self.chunks_metadata:
            self.index = None
            return

        texts = [c["text"] for c in self.chunks_metadata]
        self.embedder.fit_corpus(texts)
        embeddings = self.embedder.transform(texts)
        self.dimension = embeddings.shape[1]

        try:
            import faiss
            self.index = faiss.IndexFlatIP(self.dimension)
            self.index.add(embeddings)
        except Exception as e:
            logger.warning(f"FAISS indexing error ({e}). Using pure numpy fallback.")
            self.index = None

        # Store vectors for fallback
        for idx, chunk in enumerate(self.chunks_metadata):
            chunk["_vector"] = embeddings[idx].tolist()

    def add_documents(self, chunks: List[Dict[str, Any]]) -> int:
        if not chunks:
            return 0

        # Append chunks
        for c in chunks:
            chunk_copy = dict(c)
            chunk_copy.pop("_vector", None)
            self.chunks_metadata.append(chunk_copy)

        self._rebuild_index()
        self.save_to_disk()
        return len(chunks)

    def search(self, query: str, top_k: int = 4, threshold: float = 0.0) -> List[Dict[str, Any]]:
        if not self.chunks_metadata or not query.strip():
            return []

        query_vec = self.embedder.transform([query])
        results = []

        if self.index is not None and self.index.ntotal > 0:
            k = min(top_k, self.index.ntotal)
            distances, indices = self.index.search(query_vec, k)
            for rank, (score, idx) in enumerate(zip(distances[0], indices[0])):
                if idx < 0 or idx >= len(self.chunks_metadata):
                    continue
                score_float = float(score)
                # For normalized vectors, inner product is in [0, 1]
                normalized_score = max(0.0, min(1.0, score_float))
                if normalized_score >= threshold:
                    chunk = dict(self.chunks_metadata[idx])
                    chunk.pop("_vector", None)
                    chunk["similarity_score"] = round(normalized_score, 4)
                    chunk["raw_score"] = round(score_float, 4)
                    chunk["rank"] = rank + 1
                    results.append(chunk)
        else:
            # Pure numpy cosine search fallback
            all_vecs = np.array([c.get("_vector", np.zeros(self.dimension)) for c in self.chunks_metadata], dtype=np.float32)
            if all_vecs.shape[0] > 0 and query_vec.shape[1] == all_vecs.shape[1]:
                scores = np.dot(all_vecs, query_vec[0])
                ranked_indices = np.argsort(scores)[::-1][:top_k]
                for rank, idx in enumerate(ranked_indices):
                    score_float = float(scores[idx])
                    normalized_score = max(0.0, min(1.0, score_float))
                    if normalized_score >= threshold:
                        chunk = dict(self.chunks_metadata[idx])
                        chunk.pop("_vector", None)
                        chunk["similarity_score"] = round(normalized_score, 4)
                        chunk["raw_score"] = round(score_float, 4)
                        chunk["rank"] = rank + 1
                        results.append(chunk)

        return results

    def encode(self, texts: List[str]) -> np.ndarray:
        return self.embedder.transform(texts)

    def delete_document(self, document_id: str) -> int:
        initial_count = len(self.chunks_metadata)
        self.chunks_metadata = [c for c in self.chunks_metadata if c.get("document_id") != document_id]
        deleted_count = initial_count - len(self.chunks_metadata)

        if deleted_count > 0:
            self._rebuild_index()
            self.save_to_disk()

        return deleted_count

    def get_chunks_by_document(self, document_id: str) -> List[Dict[str, Any]]:
        return [
            {k: v for k, v in c.items() if k != "_vector"}
            for c in self.chunks_metadata if c.get("document_id") == document_id
        ]

    def get_all_chunks(self) -> List[Dict[str, Any]]:
        return [
            {k: v for k, v in c.items() if k != "_vector"}
            for c in self.chunks_metadata
        ]

    def clear(self):
        self.chunks_metadata = []
        self.index = None
        self.save_to_disk()

    def save_to_disk(self):
        try:
            import faiss
            if self.index is not None:
                faiss.write_index(self.index, str(self.index_file))
        except Exception:
            pass

        try:
            clean_meta = []
            for c in self.chunks_metadata:
                cc = dict(c)
                clean_meta.append(cc)
            with open(self.meta_file, "w", encoding="utf-8") as f:
                json.dump(clean_meta, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist chunk metadata: {e}")

    def load_from_disk(self):
        if self.meta_file.exists():
            try:
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    self.chunks_metadata = json.load(f)
                self._rebuild_index()
            except Exception as e:
                logger.error(f"Failed to load chunk metadata: {e}")
                self.chunks_metadata = []

vector_store = VectorStoreManager()
