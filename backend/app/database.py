import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings

def get_connection():
    conn = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Documents catalog table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        uploaded_by TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'indexed'
    )
    """)

    # Chat history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'demo_user',
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        citations_json TEXT DEFAULT '[]',
        model_used TEXT NOT NULL,
        latency_ms REAL NOT NULL,
        groundedness_score REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Evaluation experiment logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_name TEXT NOT NULL,
        total_questions INTEGER NOT NULL,
        avg_precision REAL NOT NULL,
        avg_recall REAL NOT NULL,
        avg_f1 REAL NOT NULL,
        avg_mrr REAL NOT NULL,
        avg_groundedness REAL NOT NULL,
        avg_hallucination_rate REAL NOT NULL,
        avg_latency_ms REAL NOT NULL,
        results_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

# Initialize DB upon import
init_db()
