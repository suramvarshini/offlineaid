"""
OfflineAid - Python Standard Library HTTP Server
Zero-Dependency Emergency Assistant Backend
Runs on http.server without any external framework.
"""

import sys
import os
import json
import mimetypes
import urllib.parse
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

import database

# Paths
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Port configuration
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8000))

class OfflineAidHandler(BaseHTTPRequestHandler):
    """Custom HTTP Request Handler serving static files & REST API endpoints."""

    def log_message(self, format, *args):
        """Clean console output formatting."""
        sys.stdout.write(f"[{self.log_date_time_string()}] {self.command} {self.path} -> {args[0]}\n")

    def send_json_response(self, data, status_code=200):
        """Helper to send JSON response with security headers."""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Security & Offline headers
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status_code=400):
        self.send_json_response({"error": message, "success": False}, status_code)

    def read_json_body(self):
        """Helper to read and parse JSON request body safely."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw_data = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw_data)
        except Exception:
            return None

    def serve_static_file(self, req_path):
        """Serves HTML, CSS, JS, SVG assets from static/ directory."""
        if req_path == "/" or req_path == "":
            file_path = STATIC_DIR / "index.html"
        else:
            # Strip leading slash and prevent directory traversal
            clean_path = req_path.lstrip("/").replace("..", "")
            file_path = (STATIC_DIR / clean_path).resolve()

        # Ensure requested file is within STATIC_DIR
        if not str(file_path).startswith(str(STATIC_DIR.resolve())):
            self.send_error(403, "Access Denied")
            return

        if not file_path.exists() or not file_path.is_file():
            # Fallback to index.html for Single Page App routing
            file_path = STATIC_DIR / "index.html"

        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            if file_path.suffix == ".js":
                mime_type = "application/javascript"
            elif file_path.suffix == ".css":
                mime_type = "text/css"
            elif file_path.suffix == ".html":
                mime_type = "text/html"
            else:
                mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {str(e)}")

    def do_GET(self):
        """Route GET requests for static files or API endpoints."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Route API requests
        if path.startswith("/api/"):
            self.handle_api_get(path, query)
        else:
            self.serve_static_file(path)

    def handle_api_get(self, path, query):
        if path == "/api/status":
            self.send_json_response({
                "status": "ok",
                "offline_ready": True,
                "app_name": "OfflineAid",
                "message": "Local server operating cleanly without internet dependencies."
            })

        elif path == "/api/contacts":
            contacts = database.get_contacts()
            self.send_json_response({"contacts": contacts, "count": len(contacts)})

        elif path.startswith("/api/contacts/"):
            parts = path.split("/")
            if len(parts) >= 4 and parts[3].isdigit():
                contact_id = int(parts[3])
                contact = database.get_contact(contact_id)
                if contact:
                    self.send_json_response(contact)
                else:
                    self.send_error_json("Contact not found", 404)
            else:
                self.send_error_json("Invalid contact ID", 400)

        elif path == "/api/profile":
            profile = database.get_profile()
            self.send_json_response(profile)

        elif path == "/api/checklists":
            checklists = database.get_checklists()
            self.send_json_response({"checklists": checklists})

        elif path == "/api/preparedness":
            prep = database.get_preparedness()
            self.send_json_response({"preparedness": prep})

        elif path == "/api/firstaid":
            fa = database.get_first_aid()
            self.send_json_response({"first_aid": fa})

        elif path.startswith("/api/firstaid/"):
            parts = path.split("/")
            if len(parts) >= 4:
                fa_id = parts[3]
                guide = database.get_first_aid_by_id(fa_id)
                if guide:
                    self.send_json_response(guide)
                else:
                    self.send_error_json("First aid guide not found", 404)
            else:
                self.send_error_json("Invalid first aid ID", 400)

        elif path == "/api/search":
            q = query.get("q", [""])[0]
            results = database.search_all(q)
            self.send_json_response({"query": q, "results": results})

        elif path == "/api/export":
            export_data = database.export_data()
            self.send_json_response(export_data)

        else:
            self.send_error_json("API endpoint not found", 404)

    def do_POST(self):
        """Route POST requests for API actions."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if not path.startswith("/api/"):
            self.send_error_json("Invalid POST path", 400)
            return

        body = self.read_json_body()
        if body is None:
            self.send_error_json("Invalid JSON payload", 400)
            return

        if path == "/api/contacts":
            name = body.get("name")
            phone = body.get("phone")
            if not name or not phone:
                self.send_error_json("Name and Phone are required", 400)
                return
            new_contact = database.add_contact(
                name=name,
                phone=phone,
                relationship=body.get("relationship", ""),
                notes=body.get("notes", "")
            )
            self.send_json_response({"success": True, "contact": new_contact}, 201)

        elif path == "/api/checklists/progress":
            checklist_id = body.get("id")
            completed_items = body.get("completed_items", [])
            if not checklist_id:
                self.send_error_json("Checklist ID is required", 400)
                return
            database.update_checklist_progress(checklist_id, completed_items)
            self.send_json_response({"success": True})

        elif path == "/api/checklists/reset":
            checklist_id = body.get("id")
            database.reset_checklist_progress(checklist_id)
            self.send_json_response({"success": True})

        elif path == "/api/preparedness/progress":
            prep_id = body.get("id")
            completed = body.get("completed", 0)
            if not prep_id:
                self.send_error_json("Preparedness item ID required", 400)
                return
            database.update_preparedness_progress(prep_id, completed)
            self.send_json_response({"success": True})

        elif path == "/api/preparedness/reset":
            database.reset_preparedness_progress()
            self.send_json_response({"success": True})

        elif path == "/api/import":
            success = database.import_data(body)
            self.send_json_response({"success": success, "message": "Local backup restored successfully."})

        elif path == "/api/reset":
            database.reset_data()
            self.send_json_response({"success": True, "message": "All data has been reset to initial seed state."})

        else:
            self.send_error_json("API endpoint not found", 404)

    def do_PUT(self):
        """Route PUT requests for API updates."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        body = self.read_json_body()
        if body is None:
            self.send_error_json("Invalid JSON payload", 400)
            return

        if path.startswith("/api/contacts/"):
            parts = path.split("/")
            if len(parts) >= 4 and parts[3].isdigit():
                contact_id = int(parts[3])
                updated = database.update_contact(
                    contact_id,
                    name=body.get("name", ""),
                    phone=body.get("phone", ""),
                    relationship=body.get("relationship", ""),
                    notes=body.get("notes", "")
                )
                if updated:
                    self.send_json_response({"success": True, "contact": updated})
                else:
                    self.send_error_json("Contact not found", 404)
            else:
                self.send_error_json("Invalid contact ID", 400)

        elif path == "/api/profile":
            updated_profile = database.update_profile(body)
            self.send_json_response({"success": True, "profile": updated_profile})

        else:
            self.send_error_json("API endpoint not found", 404)

    def do_DELETE(self):
        """Route DELETE requests."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/contacts/"):
            parts = path.split("/")
            if len(parts) >= 4 and parts[3].isdigit():
                contact_id = int(parts[3])
                deleted = database.delete_contact(contact_id)
                if deleted:
                    self.send_json_response({"success": True, "message": "Contact deleted"})
                else:
                    self.send_error_json("Contact not found", 404)
            else:
                self.send_error_json("Invalid contact ID", 400)
        else:
            self.send_error_json("API endpoint not found", 404)


def run_server():
    """Starts the OfflineAid local web server."""
    # Ensure database is initialized
    database.init_db()

    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, OfflineAidHandler)

    print("=" * 60)
    print("  OfflineAid - Emergency Preparedness Assistant")
    print("  ZERO DEPENDENCY HACKATHON PROJECT")
    print("=" * 60)
    print(f"  [+] Server running at: http://{HOST}:{PORT}")
    print("  [+] Mode: Local Offline-First")
    print("  [+] Database: SQLite (offlineaid.db)")
    print("  [+] Press Ctrl+C to stop server.")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  [-] Shutting down OfflineAid server.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
