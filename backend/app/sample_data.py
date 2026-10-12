import os
import uuid
from pathlib import Path
from typing import List, Dict, Any
from docx import Document as DocxDocument
from fpdf import FPDF
from app.config import settings
from app.document_processor import document_processor
from app.vector_store import vector_store
from app.database import get_connection

SAMPLE_BENCHMARK_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "q1",
        "category": "Human Resources",
        "question": "What is the company 401(k) matching policy and vesting schedule?",
        "expected_answer": "The company matches dollar-for-dollar up to 5% of eligible salary with 100% immediate vesting upon enrollment.",
        "expected_sources": ["Acme_HR_Benefits_Guide_2025.docx"]
    },
    {
        "id": "q2",
        "category": "Human Resources",
        "question": "How many days of Paid Time Off (PTO) do employees receive and what is the rollover limit?",
        "expected_answer": "Employees receive 22 days of PTO per calendar year, accruing at 1.83 days per month. A maximum of 8 unused days can roll over into the next year.",
        "expected_sources": ["Acme_HR_Benefits_Guide_2025.docx"]
    },
    {
        "id": "q3",
        "category": "Human Resources",
        "question": "What is the remote work stipend and monthly allowance?",
        "expected_answer": "New employees receive a one-time home office setup stipend of $1,000 and an ongoing monthly internet/wellness reimbursement of $80.",
        "expected_sources": ["Acme_HR_Benefits_Guide_2025.docx"]
    },
    {
        "id": "q4",
        "category": "Cybersecurity",
        "question": "What are the password complexity requirements and expiration timeframe?",
        "expected_answer": "Passwords must be at least 14 characters long, include uppercase, lowercase, numbers, and symbols, and must be rotated every 90 days. 2FA is mandatory.",
        "expected_sources": ["Cybersecurity_Incident_Response_Policy.pdf"]
    },
    {
        "id": "q5",
        "category": "Cybersecurity",
        "question": "What is the mandatory timeline for reporting a suspected data breach or security incident?",
        "expected_answer": "All suspected security incidents or data breaches must be reported to the Security Operations Center (soc@enterprise.internal) within 1 hour of discovery.",
        "expected_sources": ["Cybersecurity_Incident_Response_Policy.pdf"]
    },
    {
        "id": "q6",
        "category": "Infrastructure",
        "question": "What are the Recovery Point Objective (RPO) and Recovery Time Objective (RTO) targets?",
        "expected_answer": "The cloud disaster recovery targets are an RPO of less than 15 minutes and an RTO of less than 60 minutes for tier-1 production services.",
        "expected_sources": ["Enterprise_Cloud_Architecture_Guide.txt"]
    },
    {
        "id": "q7",
        "category": "Infrastructure",
        "question": "How is the production Kubernetes cluster configured for auto-scaling and high availability?",
        "expected_answer": "EKS clusters are deployed across three availability zones (us-east-1a, 1b, 1c) with cluster autoscaling configured from 6 to 30 compute nodes.",
        "expected_sources": ["Enterprise_Cloud_Architecture_Guide.txt"]
    },
    # Out of Domain Questions (Evaluating Hallucination Rejection)
    {
        "id": "q8",
        "category": "Hallucination Test",
        "question": "What is the corporate policy regarding bringing personal exotic pets like parrots or monkeys to the office?",
        "expected_answer": "I am sorry, but the uploaded enterprise documents do not contain information to answer this question.",
        "expected_sources": []
    },
    {
        "id": "q9",
        "category": "Hallucination Test",
        "question": "What is the secret recipe and chemical composition of Coca-Cola syrup?",
        "expected_answer": "I am sorry, but the uploaded enterprise documents do not contain information to answer this question.",
        "expected_sources": []
    },
    {
        "id": "q10",
        "category": "Hallucination Test",
        "question": "How many days of mandatory space travel training are required for new software engineers?",
        "expected_answer": "I am sorry, but the uploaded enterprise documents do not contain information to answer this question.",
        "expected_sources": []
    }
]

def create_sample_files() -> List[Path]:
    samples_dir = settings.UPLOADS_DIR / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    created_paths = []

    # 1. Create DOCX: Acme_HR_Benefits_Guide_2025.docx
    docx_path = samples_dir / "Acme_HR_Benefits_Guide_2025.docx"
    doc = DocxDocument()
    doc.add_heading("Acme Corporation - Employee Benefits & Policies Guide 2025", 0)
    
    doc.add_heading("1. Retirement & 401(k) Plan", level=1)
    doc.add_paragraph(
        "Acme Corporation sponsors a premier 401(k) retirement plan administered via Fidelity Investments. "
        "The company provides a dollar-for-dollar matching contribution of up to 5% of your base salary. "
        "Employees enjoy 100% immediate vesting upon the first day of enrollment. Traditional pre-tax and Roth 401(k) options are both supported."
    )

    doc.add_heading("2. Paid Time Off (PTO) & Leave", level=1)
    doc.add_paragraph(
        "Full-time regular employees are granted 22 days of paid time off per calendar year, which accrues pro-rata at 1.83 days per month. "
        "Employees may carry over a maximum of 8 unused PTO days into the following calendar year. Unused accrued days exceeding 8 will expire on December 31. "
        "In addition, Acme provides 12 paid federal holidays and 16 weeks of fully paid parental leave for primary caregivers."
    )

    doc.add_heading("3. Health, Dental & Wellness", level=1)
    doc.add_paragraph(
        "Acme covers 90% of monthly health insurance premiums for employees and 75% for dependents through BlueCross BlueShield PPO. "
        "The standard in-network deductible is $500 per individual and $1,000 for family plans. Dental and Vision coverage are provided at no cost."
    )

    doc.add_heading("4. Remote Work & Home Office Allowances", level=1)
    doc.add_paragraph(
        "Remote and hybrid employees are eligible for a one-time home office setup stipend of $1,000 upon hire to purchase ergonomic desk equipment. "
        "In addition, employees receive an ongoing monthly expense stipend of $80 to offset high-speed internet and mobile data costs."
    )
    doc.save(str(docx_path))
    created_paths.append(docx_path)

    # 2. Create PDF: Cybersecurity_Incident_Response_Policy.pdf
    pdf_path = samples_dir / "Cybersecurity_Incident_Response_Policy.pdf"
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Enterprise Cybersecurity & Incident Response Policy", ln=True, align="C")
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "1. Authentication and Credential Standards", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, (
        "All corporate systems require multi-factor authentication (2FA) via hardware security keys or authenticator apps. "
        "Passwords must be at least 14 characters in length and include uppercase letters, lowercase letters, numbers, and special symbols. "
        "Passwords must be changed every 90 days, and previous 10 passwords cannot be reused. Service accounts must utilize certificate-based auth."
    ))
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "2. Incident Reporting Mandate & SLA", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, (
        "Any employee who identifies or suspects a security breach, ransomware alert, lost hardware device, or unauthorized data exposure "
        "must report the event to the Security Operations Center (soc@enterprise.internal) within exactly 1 hour of discovery. "
        "Failure to report a breach within this 1-hour window constitutes a gross compliance violation. The incident response hotline is available 24/7/365."
    ))
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "3. Data Classification and Storage Protocols", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, (
        "Corporate data is divided into three tiers: Public, Internal, and Restricted. "
        "Restricted data contains customer PII, payment info, and encryption keys. "
        "All Restricted data must be encrypted with AES-256 at rest and TLS 1.3 in transit. Storage on unapproved personal cloud drives is strictly forbidden."
    ))
    pdf.output(str(pdf_path))
    created_paths.append(pdf_path)

    # 3. Create TXT: Enterprise_Cloud_Architecture_Guide.txt
    txt_path = samples_dir / "Enterprise_Cloud_Architecture_Guide.txt"
    txt_content = """# Enterprise Cloud Architecture & Resilience Guide v4.2

## 1. High Availability & Kubernetes Configuration
The enterprise production runtime operates on AWS Elastic Kubernetes Service (EKS) across three distinct availability zones:
- Availability Zones: us-east-1a, us-east-1b, us-east-1c
- Node Autoscaling: Dynamic horizontal autoscaling ranges from a baseline of 6 nodes up to 30 nodes during peak traffic.
- Cluster Health Checks: Pod readiness and liveness probes run every 10 seconds. Ingress is governed by AWS Application Load Balancers with AWS WAF protection.

## 2. Disaster Recovery Targets (RPO & RTO)
Enterprise business continuity standards define strict disaster recovery metrics:
- Recovery Point Objective (RPO): Strictly less than 15 minutes. Transaction logs and database write-ahead logs are mirrored to secondary regions asynchronously.
- Recovery Time Objective (RTO): Strictly less than 60 minutes for all Tier-1 revenue-generating applications. Automated failover switches DNS records via Route 53 with 30-second TTL.

## 3. Database Architecture & Compliance
Primary operational databases utilize Amazon Aurora PostgreSQL Multi-AZ with automatic failover in under 30 seconds.
For European Union compliance and GDPR data residency, European customer workloads are strictly partitioned in eu-west-1 (Ireland) with dedicated KMS encryption keys.
Automated snapshot backups execute every 6 hours and are retained for 35 days with immutable Object Lock in Amazon S3.
"""
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(txt_content)
    created_paths.append(txt_path)

    return created_paths

def seed_sample_documents_if_needed():
    """Seeds sample documents into the system if database is empty."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM documents")
    count = cursor.fetchone()["cnt"]
    conn.close()

    if count == 0:
        load_sample_documents()

def load_sample_documents() -> List[Dict[str, Any]]:
    """Generates sample files and indexes them in the database and vector store."""
    file_paths = create_sample_files()
    loaded_docs = []

    conn = get_connection()
    cursor = conn.cursor()

    for file_path in file_paths:
        filename = file_path.name
        # Check if already in DB
        cursor.execute("SELECT id FROM documents WHERE filename = ?", (filename,))
        existing = cursor.fetchone()
        
        doc_id = existing["id"] if existing else f"doc_{uuid.uuid4().hex[:8]}"

        # Remove previous chunks if re-loading
        vector_store.delete_document(doc_id)

        chunks = document_processor.process_file(
            file_path=file_path,
            doc_id=doc_id,
            original_filename=filename,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP
        )

        vector_store.add_documents(chunks)

        file_size = file_path.stat().st_size
        file_type = file_path.suffix.replace(".", "").upper()

        if existing:
            cursor.execute(
                "UPDATE documents SET chunk_count = ?, file_size = ?, status = 'indexed' WHERE id = ?",
                (len(chunks), file_size, doc_id)
            )
        else:
            cursor.execute(
                "INSERT INTO documents (id, filename, file_type, file_size, chunk_count, uploaded_by, status) VALUES (?, ?, ?, ?, ?, 'system', 'indexed')",
                (doc_id, filename, file_type, file_size, len(chunks))
            )

        loaded_docs.append({
            "id": doc_id,
            "filename": filename,
            "file_type": file_type,
            "file_size": file_size,
            "chunk_count": len(chunks)
        })

    conn.commit()
    conn.close()
    return loaded_docs
