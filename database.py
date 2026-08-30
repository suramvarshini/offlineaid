"""
OfflineAid - Local Database Manager (SQLite3)
Zero-Dependency Emergency Information & Preparedness Assistant
Uses Python standard library sqlite3 only.
"""

import os
import json
import sqlite3
import threading
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "offlineaid.db"
SEED_PATH = BASE_DIR / "data" / "seed_data.json"

_thread_local = threading.local()

def get_db():
    """Returns a thread-local SQLite connection with dictionary row factory."""
    if not hasattr(_thread_local, "connection") or _thread_local.connection is None:
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        _thread_local.connection = conn
    return _thread_local.connection

def init_db():
    """Initializes the database schema and loads seed data if database is new."""
    conn = get_db()
    cursor = conn.cursor()

    # Contacts table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            relationship TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Profile table (single row)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            full_name TEXT,
            blood_group TEXT,
            allergies TEXT,
            emergency_contact TEXT,
            medications TEXT,
            medical_notes TEXT,
            important_documents TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Checklists table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS checklists (
            id TEXT PRIMARY KEY,
            category TEXT,
            title TEXT NOT NULL,
            items TEXT NOT NULL,          -- JSON list of strings
            completed_items TEXT NOT NULL -- JSON list of strings
        )
    """)

    # Preparedness table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS preparedness (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0
        )
    """)

    # First aid table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS first_aid (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            warning TEXT,
            steps TEXT NOT NULL -- JSON list of strings
        )
    """)

    conn.commit()

    # Check if database needs initial seeding
    cursor.execute("SELECT COUNT(*) as cnt FROM contacts")
    count = cursor.fetchone()["cnt"]
    if count == 0:
        seed_data()

def seed_data():
    """Loads seed data from seed_data.json into the SQLite database."""
    if not SEED_PATH.exists():
        return

    with open(SEED_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = get_db()
    cursor = conn.cursor()

    # Clear existing
    cursor.execute("DELETE FROM contacts")
    cursor.execute("DELETE FROM profile")
    cursor.execute("DELETE FROM checklists")
    cursor.execute("DELETE FROM preparedness")
    cursor.execute("DELETE FROM first_aid")

    # Seed contacts
    for c in data.get("contacts", []):
        cursor.execute(
            "INSERT INTO contacts (id, name, phone, relationship, notes) VALUES (?, ?, ?, ?, ?)",
            (c.get("id"), c.get("name"), c.get("phone"), c.get("relationship", ""), c.get("notes", ""))
        )

    # Seed profile
    prof = data.get("profile", {})
    cursor.execute(
        """INSERT INTO profile (id, full_name, blood_group, allergies, emergency_contact, medications, medical_notes, important_documents)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?)""",
        (
            prof.get("full_name", ""),
            prof.get("blood_group", ""),
            prof.get("allergies", ""),
            prof.get("emergency_contact", ""),
            prof.get("medications", ""),
            prof.get("medical_notes", ""),
            prof.get("important_documents", "")
        )
    )

    # Seed checklists
    for chk in data.get("checklists", []):
        cursor.execute(
            "INSERT INTO checklists (id, category, title, items, completed_items) VALUES (?, ?, ?, ?, ?)",
            (
                chk.get("id"),
                chk.get("category", "Disaster"),
                chk.get("title"),
                json.dumps(chk.get("items", [])),
                json.dumps(chk.get("completed_items", []))
            )
        )

    # Seed preparedness
    for prep in data.get("preparedness", []):
        cursor.execute(
            "INSERT INTO preparedness (id, title, completed) VALUES (?, ?, ?)",
            (prep.get("id"), prep.get("title"), prep.get("completed", 0))
        )

    # Seed first aid
    for fa in data.get("first_aid", []):
        cursor.execute(
            "INSERT INTO first_aid (id, category, title, summary, warning, steps) VALUES (?, ?, ?, ?, ?, ?)",
            (
                fa.get("id"),
                fa.get("category"),
                fa.get("title"),
                fa.get("summary"),
                fa.get("warning", ""),
                json.dumps(fa.get("steps", []))
            )
        )

    conn.commit()

# --- CONTACTS CRUD ---

def get_contacts():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, phone, relationship, notes, created_at FROM contacts ORDER BY id ASC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

def get_contact(contact_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, phone, relationship, notes, created_at FROM contacts WHERE id = ?", (contact_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def add_contact(name, phone, relationship="", notes=""):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO contacts (name, phone, relationship, notes) VALUES (?, ?, ?, ?)",
        (name, phone, relationship, notes)
    )
    conn.commit()
    return get_contact(cursor.lastrowid)

def update_contact(contact_id, name, phone, relationship="", notes=""):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE contacts SET name = ?, phone = ?, relationship = ?, notes = ? WHERE id = ?",
        (name, phone, relationship, notes, contact_id)
    )
    conn.commit()
    return get_contact(contact_id)

def delete_contact(contact_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
    conn.commit()
    return cursor.rowcount > 0

# --- PROFILE API ---

def get_profile():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT full_name, blood_group, allergies, emergency_contact, medications, medical_notes, important_documents, updated_at FROM profile WHERE id = 1")
    row = cursor.fetchone()
    if not row:
        return {
            "full_name": "", "blood_group": "", "allergies": "", "emergency_contact": "",
            "medications": "", "medical_notes": "", "important_documents": ""
        }
    return dict(row)

def update_profile(data):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO profile (id, full_name, blood_group, allergies, emergency_contact, medications, medical_notes, important_documents, updated_at)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
               full_name = excluded.full_name,
               blood_group = excluded.blood_group,
               allergies = excluded.allergies,
               emergency_contact = excluded.emergency_contact,
               medications = excluded.medications,
               medical_notes = excluded.medical_notes,
               important_documents = excluded.important_documents,
               updated_at = CURRENT_TIMESTAMP
        """,
        (
            data.get("full_name", ""),
            data.get("blood_group", ""),
            data.get("allergies", ""),
            data.get("emergency_contact", ""),
            data.get("medications", ""),
            data.get("medical_notes", ""),
            data.get("important_documents", "")
        )
    )
    conn.commit()
    return get_profile()

# --- CHECKLISTS API ---

def get_checklists():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, category, title, items, completed_items FROM checklists ORDER BY title ASC")
    rows = cursor.fetchall()
    result = []
    for r in rows:
        item = dict(r)
        item["items"] = json.loads(item["items"]) if item["items"] else []
        item["completed_items"] = json.loads(item["completed_items"]) if item["completed_items"] else []
        result.append(item)
    return result

def update_checklist_progress(checklist_id, completed_items):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE checklists SET completed_items = ? WHERE id = ?",
        (json.dumps(completed_items), checklist_id)
    )
    conn.commit()
    return True

def reset_checklist_progress(checklist_id=None):
    conn = get_db()
    cursor = conn.cursor()
    if checklist_id:
        cursor.execute("UPDATE checklists SET completed_items = '[]' WHERE id = ?", (checklist_id,))
    else:
        cursor.execute("UPDATE checklists SET completed_items = '[]'")
    conn.commit()
    return True

# --- PREPAREDNESS API ---

def get_preparedness():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, completed FROM preparedness ORDER BY id ASC")
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

def update_preparedness_progress(prep_id, completed):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE preparedness SET completed = ? WHERE id = ?", (1 if completed else 0, prep_id))
    conn.commit()
    return True

def reset_preparedness_progress():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE preparedness SET completed = 0")
    conn.commit()
    return True

# --- FIRST AID API ---

def get_first_aid():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, category, title, summary, warning, steps FROM first_aid ORDER BY category, title ASC")
    rows = cursor.fetchall()
    result = []
    for r in rows:
        item = dict(r)
        item["steps"] = json.loads(item["steps"]) if item["steps"] else []
        result.append(item)
    return result

def get_first_aid_by_id(fa_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, category, title, summary, warning, steps FROM first_aid WHERE id = ?", (fa_id,))
    r = cursor.fetchone()
    if not r:
        return None
    item = dict(r)
    item["steps"] = json.loads(item["steps"]) if item["steps"] else []
    return item

# --- SEARCH API ---

def search_all(query):
    if not query or len(query.strip()) == 0:
        return {"contacts": [], "first_aid": [], "checklists": [], "preparedness": []}

    q = f"%{query.strip()}%"
    conn = get_db()
    cursor = conn.cursor()

    # Search contacts
    cursor.execute("SELECT id, name, phone, relationship, notes FROM contacts WHERE name LIKE ? OR phone LIKE ? OR relationship LIKE ? OR notes LIKE ?", (q, q, q, q))
    contacts = [dict(r) for r in cursor.fetchall()]

    # Search first aid
    cursor.execute("SELECT id, category, title, summary, warning, steps FROM first_aid WHERE title LIKE ? OR summary LIKE ? OR category LIKE ? OR steps LIKE ?", (q, q, q, q))
    fa_rows = cursor.fetchall()
    first_aid = []
    for r in fa_rows:
        item = dict(r)
        item["steps"] = json.loads(item["steps"]) if item["steps"] else []
        first_aid.append(item)

    # Search checklists
    cursor.execute("SELECT id, category, title, items, completed_items FROM checklists WHERE title LIKE ? OR items LIKE ?", (q, q))
    chk_rows = cursor.fetchall()
    checklists = []
    for r in chk_rows:
        item = dict(r)
        item["items"] = json.loads(item["items"]) if item["items"] else []
        item["completed_items"] = json.loads(item["completed_items"]) if item["completed_items"] else []
        checklists.append(item)

    # Search preparedness
    cursor.execute("SELECT id, title, completed FROM preparedness WHERE title LIKE ?", (q,))
    preparedness = [dict(r) for r in cursor.fetchall()]

    return {
        "contacts": contacts,
        "first_aid": first_aid,
        "checklists": checklists,
        "preparedness": preparedness
    }

# --- EXPORT & IMPORT & RESET ---

def export_data():
    return {
        "contacts": get_contacts(),
        "profile": get_profile(),
        "checklists": get_checklists(),
        "preparedness": get_preparedness(),
        "first_aid": get_first_aid(),
        "export_metadata": {
            "application": "OfflineAid",
            "version": "1.0",
            "offline_verified": True
        }
    }

def import_data(payload):
    conn = get_db()
    cursor = conn.cursor()

    # Import contacts
    if "contacts" in payload and isinstance(payload["contacts"], list):
        cursor.execute("DELETE FROM contacts")
        for c in payload["contacts"]:
            cursor.execute(
                "INSERT INTO contacts (name, phone, relationship, notes) VALUES (?, ?, ?, ?)",
                (c.get("name", ""), c.get("phone", ""), c.get("relationship", ""), c.get("notes", ""))
            )

    # Import profile
    if "profile" in payload and isinstance(payload["profile"], dict):
        update_profile(payload["profile"])

    # Import checklists
    if "checklists" in payload and isinstance(payload["checklists"], list):
        for chk in payload["checklists"]:
            cursor.execute(
                "UPDATE checklists SET completed_items = ? WHERE id = ?",
                (json.dumps(chk.get("completed_items", [])), chk.get("id"))
            )

    # Import preparedness
    if "preparedness" in payload and isinstance(payload["preparedness"], list):
        for prep in payload["preparedness"]:
            cursor.execute(
                "UPDATE preparedness SET completed = ? WHERE id = ?",
                (1 if prep.get("completed") else 0, prep.get("id"))
            )

    conn.commit()
    return True

def reset_data():
    seed_data()
    return True
