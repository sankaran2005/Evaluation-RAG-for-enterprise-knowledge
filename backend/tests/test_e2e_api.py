import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.sample_data import load_sample_documents

client = TestClient(app)

@pytest.fixture(autouse=True)
def ensure_samples_loaded():
    load_sample_documents()

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "total_indexed_chunks" in data

def test_auth_login():
    response = client.post("/api/auth/login", json={
        "email_or_username": "demo@enterprise.ai",
        "password": "demo123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "demo@enterprise.ai"

def test_documents_list():
    response = client.get("/api/documents")
    assert response.status_code == 200
    docs = response.json()["documents"]
    assert len(docs) >= 3

def test_chat_query_grounded():
    response = client.post("/api/chat", json={
        "question": "What is the 401(k) company match policy?"
    })
    assert response.status_code == 200
    data = response.json()
    assert "5%" in data["answer"]
    assert data["groundedness_score"] > 0.5
    assert len(data["citations"]) > 0

def test_chat_query_hallucination_abstain():
    response = client.post("/api/chat", json={
        "question": "What is the secret recipe for Coca-Cola?"
    })
    assert response.status_code == 200
    data = response.json()
    assert "do not contain information" in data["answer"].lower()

def test_side_by_side_comparison():
    response = client.post("/api/chat/compare", json={
        "question": "What is the policy for reporting security incidents?"
    })
    assert response.status_code == 200
    data = response.json()
    assert "rag" in data
    assert "basic_llm" in data
    assert data["rag"]["groundedness_score"] > data["basic_llm"]["groundedness_score"]

def test_evaluation_benchmark_run():
    response = client.post("/api/evaluation/run?top_k=4")
    assert response.status_code == 200
    report = response.json()
    assert "retrieval" in report
    assert "rag_generation" in report
    assert "comparison" in report
    assert report["total_questions"] == 10
    assert report["retrieval"]["precision"] > 0.0
    assert report["retrieval"]["recall"] > 0.0
    assert report["retrieval"]["f1"] > 0.0
    assert report["comparison"]["hallucination_reduction_pct"] > 50.0

def test_stats_endpoint():
    response = client.get("/api/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["documents"]["count"] >= 3
