import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import pypdf
from docx import Document as DocxDocument

class DocumentProcessor:
    def __init__(self, default_chunk_size: int = 500, default_chunk_overlap: int = 100):
        self.default_chunk_size = default_chunk_size
        self.default_chunk_overlap = default_chunk_overlap

    def clean_text(self, text: str) -> str:
        """Normalize whitespaces and remove non-printable characters."""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def extract_from_pdf(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text page by page from PDF using PyPDF."""
        pages_content = []
        try:
            reader = pypdf.PdfReader(str(file_path))
            for page_idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                cleaned = self.clean_text(page_text)
                if cleaned:
                    pages_content.append({
                        "page_number": page_idx + 1,
                        "text": cleaned
                    })
        except Exception as e:
            raise ValueError(f"Failed to parse PDF {file_path.name}: {str(e)}")
        return pages_content

    def extract_from_docx(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract paragraphs and tables from DOCX using python-docx."""
        try:
            doc = DocxDocument(str(file_path))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            
            # Also extract text from tables if any
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        paragraphs.append(row_text)
            
            full_text = "\n\n".join(paragraphs)
            cleaned = self.clean_text(full_text)
            return [{"page_number": 1, "text": cleaned}] if cleaned else []
        except Exception as e:
            raise ValueError(f"Failed to parse DOCX {file_path.name}: {str(e)}")

    def extract_from_txt(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from plain text files."""
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            cleaned = self.clean_text(content)
            return [{"page_number": 1, "text": cleaned}] if cleaned else []
        except Exception as e:
            raise ValueError(f"Failed to parse TXT {file_path.name}: {str(e)}")

    def chunk_text(
        self,
        text: str,
        doc_id: str,
        filename: str,
        page_number: int = 1,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Split text into overlapping chunks respecting sentence/paragraph boundaries."""
        size = chunk_size or self.default_chunk_size
        overlap = chunk_overlap or self.default_chunk_overlap
        if overlap >= size:
            overlap = size // 4

        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""
        current_start_char = 0
        total_offset = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current_chunk) + len(para) + 2 <= size:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                    # Create overlap from end of current chunk
                    if overlap > 0 and len(current_chunk) > overlap:
                        current_chunk = current_chunk[-overlap:] + "\n\n" + para
                    else:
                        current_chunk = para
                else:
                    # Paragraph is longer than chunk_size, split by sentences or characters
                    sentences = re.split(r"(?<=[.!?])\s+", para)
                    temp_chunk = ""
                    for sent in sentences:
                        if len(temp_chunk) + len(sent) + 1 <= size:
                            temp_chunk = (temp_chunk + " " + sent).strip()
                        else:
                            if temp_chunk:
                                chunks.append(temp_chunk)
                                temp_chunk = sent
                            else:
                                # Hard slice very long sentence
                                for i in range(0, len(sent), size - overlap):
                                    chunks.append(sent[i:i + size])
                    if temp_chunk:
                        current_chunk = temp_chunk

        if current_chunk and current_chunk.strip():
            chunks.append(current_chunk.strip())

        # Build chunk metadata records
        chunk_records = []
        for idx, chunk_str in enumerate(chunks):
            chunk_records.append({
                "chunk_id": f"{doc_id}_c{idx}",
                "document_id": doc_id,
                "filename": filename,
                "chunk_index": idx,
                "page_number": page_number,
                "text": chunk_str,
                "char_length": len(chunk_str),
                "word_count": len(chunk_str.split())
            })

        return chunk_records

    def process_file(
        self,
        file_path: Path,
        doc_id: str,
        original_filename: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Extract text based on extension and return list of chunk records."""
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            sections = self.extract_from_pdf(file_path)
        elif suffix in [".docx", ".doc"]:
            sections = self.extract_from_docx(file_path)
        elif suffix in [".txt", ".md", ".json", ".csv"]:
            sections = self.extract_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {suffix}. Supported: .pdf, .docx, .txt, .md")

        all_chunks = []
        chunk_counter = 0
        for section in sections:
            section_chunks = self.chunk_text(
                text=section["text"],
                doc_id=doc_id,
                filename=original_filename,
                page_number=section.get("page_number", 1),
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
            for c in section_chunks:
                c["chunk_id"] = f"{doc_id}_c{chunk_counter}"
                c["chunk_index"] = chunk_counter
                chunk_counter += 1
                all_chunks.append(c)

        return all_chunks

document_processor = DocumentProcessor()
