from flask import Flask, request
import sqlite3
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

@app.route('/api/submit', methods=['POST'])
def submit():
    data = request.get_json()
    wallet = data.get('wallet', '').strip().lower()

    if not wallet:
        return {"error": "missing address"}, 400

    conn = sqlite3.connect('wallets.db')
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS wallets (address TEXT PRIMARY KEY)")
    try:
        c.execute("INSERT INTO wallets (address) VALUES (?)", (wallet,))
    except sqlite3.IntegrityError:
        pass
    conn.commit()
    conn.close()
    return {"success": True}
    
if __name__ == '__main__':
    app.run(debug=True)
