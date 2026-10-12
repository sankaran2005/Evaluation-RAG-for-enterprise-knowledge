import pytest
from app.vector_store import VectorStoreManager

def test_vector_store_add_and_search():
    vs = VectorStoreManager()
    vs.clear()
    
    sample_chunks = [
        {
            "chunk_id": "test_doc1_c0",
            "document_id": "test_doc1",
            "filename": "benefits.txt",
            "text": "The company matches 5% on 401(k) retirement contributions."
        },
        {
            "chunk_id": "test_doc1_c1",
            "document_id": "test_doc1",
            "filename": "benefits.txt",
            "text": "Employees receive 22 days of paid time off per year."
        },
        {
            "chunk_id": "test_doc2_c0",
            "document_id": "test_doc2",
            "filename": "security.txt",
            "text": "Security incident response must be initiated within 1 hour."
        }
    ]

    added = vs.add_documents(sample_chunks)
    assert added == 3

    results = vs.search("What is the 401(k) match limit?", top_k=2)
    assert len(results) > 0
    assert "401(k)" in results[0]["text"]
    assert 0.0 <= results[0]["similarity_score"] <= 1.0

    # Test deletion
    deleted = vs.delete_document("test_doc1")
    assert deleted == 2
    rem = vs.get_chunks_by_document("test_doc1")
    assert len(rem) == 0
