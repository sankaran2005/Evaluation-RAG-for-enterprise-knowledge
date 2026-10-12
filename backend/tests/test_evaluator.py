import pytest
from app.evaluator import RAGEvaluator, calculate_token_overlap_f1
from app.llm_engine import calculate_groundedness

def test_retrieval_metrics_calculation():
    evaluator = RAGEvaluator()
    mock_retrieved = [
        {"filename": "benefits.docx", "document_id": "doc_1"},
        {"filename": "unrelated.pdf", "document_id": "doc_2"},
        {"filename": "benefits.docx", "document_id": "doc_1"}
    ]
    expected_sources = ["benefits.docx"]

    metrics = evaluator.evaluate_retrieval(mock_retrieved, expected_sources, top_k=3)
    assert metrics["precision"] == round(2 / 3, 4)
    assert metrics["recall"] == 1.0  # At least 1 matched out of 1 expected
    assert metrics["reciprocal_rank"] == 1.0  # First retrieved was relevant
    assert metrics["hit_rate"] == 1.0

def test_groundedness_and_hallucination():
    context_chunks = [
        {"text": "The 401(k) company matching is 5% with immediate vesting."}
    ]
    grounded_answer = "The company matches up to 5% with immediate vesting for 401(k)."
    hallucinated_answer = "The company gives a free Tesla Model 3 and unlimited caviar."

    g_score = calculate_groundedness(grounded_answer, context_chunks)
    h_score = calculate_groundedness(hallucinated_answer, context_chunks)

    assert g_score >= 0.70
    assert h_score <= 0.30

def test_token_f1():
    pred = "The 401k match is 5% immediately"
    target = "The 401k match is 5% with immediate vesting"
    f1 = calculate_token_overlap_f1(pred, target)
    assert f1 > 0.60
