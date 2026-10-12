import pytest
from pathlib import Path
from app.document_processor import DocumentProcessor

def test_clean_text():
    processor = DocumentProcessor()
    raw = "Hello   world!\r\n\r\n\r\n\r\nThis   is a    test."
    cleaned = processor.clean_text(raw)
    assert "Hello world!" in cleaned
    assert "\r" not in cleaned
    assert "\n\n\n" not in cleaned

def test_chunk_text():
    processor = DocumentProcessor(default_chunk_size=100, default_chunk_overlap=20)
    sample_text = (
        "Acme Corporation provides health insurance, dental coverage, and vision care. "
        "Employees can enroll during the open enrollment window every November. "
        "The 401(k) program matches 5% of employee contributions dollar for dollar."
    )
    chunks = processor.chunk_text(
        text=sample_text,
        doc_id="test_doc_1",
        filename="test.txt",
        chunk_size=120,
        chunk_overlap=25
    )
    assert len(chunks) >= 2
    for c in chunks:
        assert c["document_id"] == "test_doc_1"
        assert c["filename"] == "test.txt"
        assert len(c["text"]) > 0
        assert "chunk_id" in c
