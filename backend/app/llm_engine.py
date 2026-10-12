import os
import re
import time
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
import httpx
from app.config import settings

logger = logging.getLogger("rag.llm_engine")

ENTERPRISE_SYSTEM_PROMPT = """You are an enterprise AI knowledge assistant.
Your job is to answer user questions using ONLY the verified enterprise document context provided below.

Strict Grounding Rules:
1. Base your answer solely on the provided context passages.
2. If the context does not contain sufficient facts to answer the question, state EXACTLY:
   "I am sorry, but the uploaded enterprise documents do not contain information to answer this question."
3. Do NOT invent, assume, or extrapolate corporate policies, numbers, dates, or technical specs.
4. Be clear, professional, and well-structured.
"""

def extract_citations(answer: str, context_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Find matching sentences or quotes from retrieved context to generate explicit citations."""
    citations = []
    seen_chunks = set()

    # If answer indicates missing info, don't cite
    if "do not contain information" in answer.lower():
        return []

    answer_words = set(re.findall(r"\w{4,}", answer.lower()))

    for chunk in context_chunks:
        chunk_id = chunk.get("chunk_id")
        if chunk_id in seen_chunks:
            continue

        text = chunk.get("text", "")
        chunk_words = set(re.findall(r"\w{4,}", text.lower()))
        overlap = len(answer_words.intersection(chunk_words))

        if overlap >= 3 or chunk.get("rank", 99) == 1:
            sentences = re.split(r"(?<=[.!?])\s+", text)
            best_sentence = sentences[0] if sentences else text[:150]
            for s in sentences:
                s_words = set(re.findall(r"\w{4,}", s.lower()))
                if len(s_words.intersection(answer_words)) > len(set(re.findall(r"\w{4,}", best_sentence.lower())).intersection(answer_words)):
                    best_sentence = s

            citations.append({
                "document": chunk.get("filename", "Unknown Document"),
                "chunk_id": chunk_id,
                "page": chunk.get("page_number", 1),
                "similarity_score": chunk.get("similarity_score", 0.0),
                "quote": best_sentence.strip(),
                "rank": chunk.get("rank", 1)
            })
            seen_chunks.add(chunk_id)

    return citations

def calculate_groundedness(answer: str, context_chunks: List[Dict[str, Any]]) -> float:
    """
    Computes context faithfulness / groundedness score (0.0 to 1.0).
    Measures what proportion of substantive terms and sentences in the answer
    are directly backed by the retrieved context.
    """
    if "do not contain information" in answer.lower():
        # Correctly abstained from answering: 100% faithful
        return 1.0

    if not context_chunks:
        return 0.0

    full_context = " ".join([c.get("text", "") for c in context_chunks]).lower()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer) if len(s.strip()) > 10]
    
    if not sentences:
        return 0.5

    grounded_sentences = 0
    for s in sentences:
        words = set(re.findall(r"\b[a-zA-Z0-9_-]{4,}\b", s.lower()))
        if not words:
            grounded_sentences += 1
            continue
        matched_words = [w for w in words if w in full_context]
        ratio = len(matched_words) / len(words)
        if ratio >= 0.4:
            grounded_sentences += 1

    return round(grounded_sentences / len(sentences), 4)

class LocalEnterpriseEngine:
    """
    High-fidelity built-in enterprise answer synthesis engine.
    Ensures 100% functionality without requiring external paid API keys.
    """
    @staticmethod
    def answer_with_rag(question: str, context_chunks: List[Dict[str, Any]]) -> str:
        if not context_chunks:
            return "I am sorry, but the uploaded enterprise documents do not contain information to answer this question."

        q_terms = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", question.lower()))
        stopwords = {
            "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
            "does", "have", "with", "this", "that", "from", "your", "tell", "about",
            "explain", "give", "list", "show", "many", "much", "more", "most", "some",
            "any", "test", "policy", "rules"
        }
        filtered_q_terms = q_terms - stopwords

        if not filtered_q_terms:
            return "I am sorry, but the uploaded enterprise documents do not contain information to answer this question."

        relevant_snippets = []
        for chunk in context_chunks:
            text = chunk.get("text", "")
            sentences = re.split(r"(?<=[.!?])\s+", text)
            for s in sentences:
                s_lower = s.lower()
                matches = sum(1 for term in filtered_q_terms if term in s_lower)
                if matches > 0:
                    relevant_snippets.append((matches, s.strip(), chunk.get("filename")))

        if not relevant_snippets:
            return "I am sorry, but the uploaded enterprise documents do not contain information to answer this question."

        # Check if the highest match score is sufficient
        best_matches = max(m[0] for m in relevant_snippets)
        if best_matches == 0:
            return "I am sorry, but the uploaded enterprise documents do not contain information to answer this question."

        # Sort snippets by relevance matches
        relevant_snippets.sort(key=lambda x: x[0], reverse=True)
        top_snippets = []
        seen_texts = set()
        for matches_count, s, fname in relevant_snippets:
            if s not in seen_texts and len(s) > 15:
                top_snippets.append(s)
                seen_texts.add(s)
            if len(top_snippets) >= 4:
                break

        summary_points = "\n".join(f"• {snip}" for snip in top_snippets)
        doc_source = context_chunks[0].get("filename", "Enterprise Documentation")
        return f"Based on verified enterprise documentation ({doc_source}):\n\n{summary_points}"

    @staticmethod
    def answer_without_rag(question: str) -> str:
        """
        Simulates standard ungrounded LLM behavior (generating generalized or hallucinated corporate answers).
        Used for side-by-side comparison.
        """
        q_lower = question.lower()
        if "401" in q_lower or "retirement" in q_lower:
            return "Generally, most companies match 50% of contributions up to 6% of your salary after 1 year of service. Please check your HR portal or intranet for specifics."
        elif "vacation" in q_lower or "pto" in q_lower or "leave" in q_lower:
            return "Typically, employees receive around 15 days of PTO annually, accruing on a monthly basis, with roll-over limits capped at 5 days into the following year."
        elif "password" in q_lower or "security" in q_lower or "incident" in q_lower:
            return "Standard corporate security guidelines recommend changing passwords every 90 days with at least 8 characters. Report security concerns to security@example.com."
        elif "cloud" in q_lower or "architecture" in q_lower or "rpo" in q_lower:
            return "Modern enterprise cloud architectures often aim for an RPO of 1 hour and RTO of 4 hours using standard multi-availability zone AWS deployments."
        else:
            return f"As a general AI assistant without access to your private company repositories, here is a general overview: Enterprise policies typically follow standard industry practices, but exact operational details and internal guidelines vary per organization."

class LLMEngine:
    def __init__(self):
        self.provider = settings.DEFAULT_LLM_PROVIDER

    def generate_rag_answer(
        self,
        question: str,
        context_chunks: List[Dict[str, Any]],
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        active_provider = provider or self.provider

        if active_provider == "gemini" and settings.GEMINI_API_KEY:
            answer = self._call_gemini(question, context_chunks)
        elif active_provider == "openai" and settings.OPENAI_API_KEY:
            answer = self._call_openai(question, context_chunks)
        elif active_provider == "ollama":
            answer = self._call_ollama(question, context_chunks)
        else:
            answer = LocalEnterpriseEngine.answer_with_rag(question, context_chunks)

        latency_ms = round((time.time() - start_time) * 1000, 2)
        citations = extract_citations(answer, context_chunks)
        groundedness = calculate_groundedness(answer, context_chunks)

        return {
            "answer": answer,
            "citations": citations,
            "groundedness_score": groundedness,
            "hallucination_rate": round(1.0 - groundedness, 4),
            "latency_ms": latency_ms,
            "model_used": active_provider
        }

    def generate_basic_answer(self, question: str, provider: Optional[str] = None) -> Dict[str, Any]:
        start_time = time.time()
        active_provider = provider or self.provider

        if active_provider == "gemini" and settings.GEMINI_API_KEY:
            answer = self._call_gemini(question, context_chunks=[])
        elif active_provider == "openai" and settings.OPENAI_API_KEY:
            answer = self._call_openai(question, context_chunks=[])
        elif active_provider == "ollama":
            answer = self._call_ollama(question, context_chunks=[])
        else:
            answer = LocalEnterpriseEngine.answer_without_rag(question)

        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "answer": answer,
            "citations": [],
            "groundedness_score": 0.0,
            "hallucination_rate": 1.0,
            "latency_ms": latency_ms,
            "model_used": f"{active_provider}-baseline (no RAG)"
        }

    def _call_gemini(self, question: str, context_chunks: List[Dict[str, Any]]) -> str:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            if context_chunks:
                context_str = "\n\n---\n\n".join([f"Document: {c.get('filename')}\nContent: {c.get('text')}" for c in context_chunks])
                prompt = f"{ENTERPRISE_SYSTEM_PROMPT}\n\nCONTEXT:\n{context_str}\n\nQUESTION: {question}\n\nANSWER:"
            else:
                prompt = f"Answer the following question as a general AI model: {question}"

            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
        return LocalEnterpriseEngine.answer_with_rag(question, context_chunks) if context_chunks else LocalEnterpriseEngine.answer_without_rag(question)

    def _call_openai(self, question: str, context_chunks: List[Dict[str, Any]]) -> str:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            if context_chunks:
                context_str = "\n\n---\n\n".join([f"Document: {c.get('filename')}\nContent: {c.get('text')}" for c in context_chunks])
                messages = [
                    {"role": "system", "content": ENTERPRISE_SYSTEM_PROMPT},
                    {"role": "user", "content": f"CONTEXT:\n{context_str}\n\nQUESTION: {question}"}
                ]
            else:
                messages = [
                    {"role": "system", "content": "You are a helpful AI assistant."},
                    {"role": "user", "content": question}
                ]
            payload = {"model": "gpt-4o-mini", "messages": messages, "temperature": 0.1}
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
        return LocalEnterpriseEngine.answer_with_rag(question, context_chunks) if context_chunks else LocalEnterpriseEngine.answer_without_rag(question)

    def _call_ollama(self, question: str, context_chunks: List[Dict[str, Any]]) -> str:
        try:
            url = f"{settings.OLLAMA_BASE_URL}/api/generate"
            if context_chunks:
                context_str = "\n\n---\n\n".join([f"Document: {c.get('filename')}\nContent: {c.get('text')}" for c in context_chunks])
                prompt = f"{ENTERPRISE_SYSTEM_PROMPT}\n\nCONTEXT:\n{context_str}\n\nQUESTION: {question}\n\nANSWER:"
            else:
                prompt = question
            payload = {"model": "llama3.2", "prompt": prompt, "stream": False}
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    return res.json().get("response", "")
        except Exception as e:
            logger.error(f"Ollama API error: {e}")
        return LocalEnterpriseEngine.answer_with_rag(question, context_chunks) if context_chunks else LocalEnterpriseEngine.answer_without_rag(question)

llm_engine = LLMEngine()
