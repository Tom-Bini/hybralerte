import sqlite3

conn = sqlite3.connect("DatabaseV1.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS user_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE
)
""")

conn.commit()
conn.close()
print("✅ Table `user_wallets` créée avec succès.")
