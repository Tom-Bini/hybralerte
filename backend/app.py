from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime, timezone
import os

app = Flask(__name__)
CORS(app, origins=["https://hybralerte.rouplou.dev"])  # Sécurise le CORS

DB_PATH = 'wallets.db'

@app.route('/api/submit', methods=['POST'])
def submit():
    print("🚨 Requête reçue sur /api/submit")
    data = request.get_json()
    address = data.get('address', '').strip().lower()

    if not address or not address.startswith("0x") or len(address) != 42:
        return jsonify({"error": "Invalid or missing address"}), 400

    timestamp = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS wallets (
            address TEXT PRIMARY KEY,
            created_at TEXT
        )
    """)
    try:
        c.execute("INSERT OR IGNORE INTO wallets (address, created_at) VALUES (?, ?)", (address, timestamp))
        print(f"[+] New address stored: {address} at {timestamp}")
    except sqlite3.IntegrityError:
        print(f"[=] Address already present: {address}")
        pass
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/points-diff/<address>')
def points_diff(address):
    import sqlite3
    from flask import jsonify
    from datetime import datetime

    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wallets.db")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT total_points, timestamp FROM wallet_stats
        WHERE address = ?
        ORDER BY timestamp DESC
        LIMIT 2
    """, (address.lower(),))
    rows = c.fetchall()
    conn.close()

    if len(rows) < 2:
        return jsonify({"diff": None})  # Pas de diff possible

    latest, previous = rows[0][0], rows[1][0]
    diff = latest - previous
    return jsonify({"diff": diff})

@app.route('/api/points-history/<address>')
def points_history(address):
    import sqlite3
    import os
    from flask import jsonify

    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wallets.db")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT total_points, timestamp FROM wallet_stats
        WHERE address = ?
        ORDER BY timestamp ASC
    """, (address.lower(),))
    rows = c.fetchall()
    conn.close()

    history = [{"timestamp": ts, "points": pts} for pts, ts in rows]
    return jsonify(history)


if __name__ == '__main__':
    app.run(debug=True)