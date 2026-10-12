import pytest
from app.llm_engine import LLMEngine

def test_grounded_answer_generation():
    engine = LLMEngine()
    context = [
        {
            "chunk_id": "c1",
            "filename": "HR_Policy.docx",
            "text": "Full-time employees receive 22 days of paid time off per calendar year.",
            "similarity_score": 0.88,
            "rank": 1
        }
    ]
    res = engine.generate_rag_answer("How many days of paid time off do employees get?", context, provider="local")
    assert "22 days" in res["answer"]
    assert res["groundedness_score"] > 0.60
    assert len(res["citations"]) > 0
    assert res["citations"][0]["document"] == "HR_Policy.docx"

def test_out_of_domain_abstention():
    engine = LLMEngine()
    # Context with low similarity score
    low_sim_context = [
        {
            "chunk_id": "c2",
            "filename": "HR_Policy.docx",
            "text": "Health benefits are administered by BlueCross BlueShield.",
            "similarity_score": 0.12,
            "rank": 1
        }
    ]
    res = engine.generate_rag_answer("What is the recipe for Coca-Cola?", low_sim_context, provider="local")
    assert "do not contain information" in res["answer"].lower()
    assert res["groundedness_score"] == 1.0  # Proper abstention has 100% faithfulness
