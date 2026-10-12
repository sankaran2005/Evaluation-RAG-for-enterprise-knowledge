import time
import json
import re
from typing import List, Dict, Any, Optional
import numpy as np
from app.vector_store import vector_store
from app.llm_engine import llm_engine, calculate_groundedness
from app.database import get_connection

def calculate_token_overlap_f1(pred: str, target: str) -> float:
    """Calculate token-level precision, recall and F1 overlap."""
    pred_tokens = re.findall(r"\b\w+\b", pred.lower())
    target_tokens = re.findall(r"\b\w+\b", target.lower())

    if not pred_tokens or not target_tokens:
        return 0.0

    common = collections_counter_intersection(pred_tokens, target_tokens)
    num_common = sum(common.values())
    if num_common == 0:
        return 0.0

    precision = num_common / len(pred_tokens)
    recall = num_common / len(target_tokens)
    if precision + recall == 0:
        return 0.0
    return round(2 * (precision * recall) / (precision + recall), 4)

def collections_counter_intersection(list1: List[str], list2: List[str]) -> Dict[str, int]:
    from collections import Counter
    c1 = Counter(list1)
    c2 = Counter(list2)
    return {k: min(c1[k], c2[k]) for k in c1 if k in c2}

class RAGEvaluator:
    def __init__(self):
        pass

    def evaluate_retrieval(
        self,
        retrieved_chunks: List[Dict[str, Any]],
        expected_sources: List[str],
        top_k: int
    ) -> Dict[str, float]:
        """
        Calculates real information retrieval metrics:
        - Precision@k
        - Recall@k
        - F1@k
        - Reciprocal Rank (RR)
        - Hit Rate
        """
        if not retrieved_chunks:
            return {
                "precision": 0.0,
                "recall": 0.0,
                "f1": 0.0,
                "reciprocal_rank": 0.0,
                "hit_rate": 0.0
            }

        k = min(top_k, len(retrieved_chunks))
        top_k_chunks = retrieved_chunks[:k]

        relevant_retrieved = 0
        first_relevant_rank = None

        expected_sources_lower = [s.lower() for s in expected_sources]

        for idx, chunk in enumerate(top_k_chunks):
            fname = chunk.get("filename", "").lower()
            doc_id = chunk.get("document_id", "").lower()
            # Relevant if filename or document matches expected sources
            is_relevant = any(exp in fname or exp in doc_id for exp in expected_sources_lower)
            if is_relevant:
                relevant_retrieved += 1
                if first_relevant_rank is None:
                    first_relevant_rank = idx + 1

        precision = relevant_retrieved / k if k > 0 else 0.0
        total_relevant = len(expected_sources) if expected_sources else 1
        recall = min(1.0, relevant_retrieved / total_relevant)

        if precision + recall > 0:
            f1 = (2 * precision * recall) / (precision + recall)
        else:
            f1 = 0.0

        rr = (1.0 / first_relevant_rank) if first_relevant_rank else 0.0
        hit_rate = 1.0 if relevant_retrieved > 0 else 0.0

        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "reciprocal_rank": round(rr, 4),
            "hit_rate": round(hit_rate, 4)
        }

    def evaluate_single_query(
        self,
        question: str,
        expected_answer: str,
        expected_sources: List[str],
        top_k: int = 4
    ) -> Dict[str, Any]:
        """Runs both RAG and basic LLM, calculates retrieval and generation metrics."""
        # 1. Retrieval
        retrieval_start = time.time()
        retrieved_chunks = vector_store.search(question, top_k=top_k)
        retrieval_time_ms = round((time.time() - retrieval_start) * 1000, 2)

        # 2. Retrieval metrics
        retrieval_metrics = self.evaluate_retrieval(retrieved_chunks, expected_sources, top_k=top_k)

        # 3. RAG generation
        rag_res = llm_engine.generate_rag_answer(question, retrieved_chunks)
        rag_token_f1 = calculate_token_overlap_f1(rag_res["answer"], expected_answer)

        # Answer relevance (approximate via token or embedding similarity)
        # Cosine similarity between question and RAG answer
        q_emb = vector_store.encode([question])
        a_emb = vector_store.encode([rag_res["answer"]])
        similarity = float(np.dot(q_emb[0], a_emb[0])) if q_emb.shape[1] == a_emb.shape[1] else 0.5
        answer_relevance = round(max(0.0, min(1.0, (similarity + 1.0) / 2.0)), 4)

        # 4. Basic LLM (Ungrounded baseline)
        basic_res = llm_engine.generate_basic_answer(question)
        basic_token_f1 = calculate_token_overlap_f1(basic_res["answer"], expected_answer)

        # Calculate basic LLM groundedness against retrieved chunks
        basic_groundedness = calculate_groundedness(basic_res["answer"], retrieved_chunks)
        basic_hallucination_rate = round(1.0 - basic_groundedness, 4)

        return {
            "question": question,
            "expected_answer": expected_answer,
            "expected_sources": expected_sources,
            "retrieval_time_ms": retrieval_time_ms,
            "total_time_ms": round(retrieval_time_ms + rag_res["latency_ms"], 2),
            "retrieval_metrics": retrieval_metrics,
            "rag": {
                "answer": rag_res["answer"],
                "citations": rag_res["citations"],
                "groundedness": rag_res["groundedness_score"],
                "hallucination_rate": rag_res["hallucination_rate"],
                "token_f1": rag_token_f1,
                "answer_relevance": answer_relevance,
                "latency_ms": rag_res["latency_ms"],
                "retrieved_chunk_count": len(retrieved_chunks)
            },
            "basic_llm": {
                "answer": basic_res["answer"],
                "groundedness": basic_groundedness,
                "hallucination_rate": basic_hallucination_rate,
                "token_f1": basic_token_f1,
                "latency_ms": basic_res["latency_ms"]
            }
        }

    def run_benchmark(self, benchmark_cases: List[Dict[str, Any]], top_k: int = 4) -> Dict[str, Any]:
        """Runs evaluation over the complete benchmark suite and compiles aggregated metrics."""
        results = []
        for case in benchmark_cases:
            item_eval = self.evaluate_single_query(
                question=case["question"],
                expected_answer=case["expected_answer"],
                expected_sources=case.get("expected_sources", []),
                top_k=top_k
            )
            item_eval["category"] = case.get("category", "General")
            results.append(item_eval)

        # Aggregate metrics
        avg_precision = np.mean([r["retrieval_metrics"]["precision"] for r in results])
        avg_recall = np.mean([r["retrieval_metrics"]["recall"] for r in results])
        avg_f1 = np.mean([r["retrieval_metrics"]["f1"] for r in results])
        avg_mrr = np.mean([r["retrieval_metrics"]["reciprocal_rank"] for r in results])
        avg_hit_rate = np.mean([r["retrieval_metrics"]["hit_rate"] for r in results])

        avg_rag_groundedness = np.mean([r["rag"]["groundedness"] for r in results])
        avg_rag_hallucination = np.mean([r["rag"]["hallucination_rate"] for r in results])
        avg_rag_token_f1 = np.mean([r["rag"]["token_f1"] for r in results])
        avg_rag_relevance = np.mean([r["rag"]["answer_relevance"] for r in results])
        avg_latency_ms = np.mean([r["total_time_ms"] for r in results])

        avg_basic_groundedness = np.mean([r["basic_llm"]["groundedness"] for r in results])
        avg_basic_hallucination = np.mean([r["basic_llm"]["hallucination_rate"] for r in results])
        avg_basic_token_f1 = np.mean([r["basic_llm"]["token_f1"] for r in results])

        hallucination_reduction = round(max(0.0, (avg_basic_hallucination - avg_rag_hallucination) / max(0.01, avg_basic_hallucination)) * 100, 2)

        summary = {
            "total_questions": len(results),
            "retrieval": {
                "precision": round(float(avg_precision), 4),
                "recall": round(float(avg_recall), 4),
                "f1": round(float(avg_f1), 4),
                "mrr": round(float(avg_mrr), 4),
                "hit_rate": round(float(avg_hit_rate), 4)
            },
            "rag_generation": {
                "avg_groundedness": round(float(avg_rag_groundedness), 4),
                "avg_hallucination_rate": round(float(avg_rag_hallucination), 4),
                "avg_token_f1": round(float(avg_rag_token_f1), 4),
                "avg_relevance": round(float(avg_rag_relevance), 4),
                "avg_latency_ms": round(float(avg_latency_ms), 2)
            },
            "comparison": {
                "rag_groundedness": round(float(avg_rag_groundedness), 4),
                "basic_groundedness": round(float(avg_basic_groundedness), 4),
                "rag_hallucination_rate": round(float(avg_rag_hallucination), 4),
                "basic_hallucination_rate": round(float(avg_basic_hallucination), 4),
                "hallucination_reduction_pct": hallucination_reduction
            },
            "test_cases": results
        }

        # Save to database
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO evaluation_runs (
                run_name, total_questions, avg_precision, avg_recall, avg_f1,
                avg_mrr, avg_groundedness, avg_hallucination_rate, avg_latency_ms, results_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"Benchmark Run {time.strftime('%Y-%m-%d %H:%M:%S')}",
                len(results),
                summary["retrieval"]["precision"],
                summary["retrieval"]["recall"],
                summary["retrieval"]["f1"],
                summary["retrieval"]["mrr"],
                summary["rag_generation"]["avg_groundedness"],
                summary["rag_generation"]["avg_hallucination_rate"],
                summary["rag_generation"]["avg_latency_ms"],
                json.dumps(summary, ensure_ascii=False)
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            pass

        return summary

evaluator = RAGEvaluator()
