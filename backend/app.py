from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)
DB_FILE = "wallets.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT UNIQUE
        )
    """)
    conn.commit()
    conn.close()

@app.route("/submit_address", methods=["POST"])
def submit_address():
    data = request.get_json()
    address = data.get("address", "").lower()

    if not address.startswith("0x") or len(address) != 42:
        return jsonify({"status": "error", "message": "Invalid address"}), 400

    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO addresses (address) VALUES (?)", (address,))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "message": "Address stored"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
