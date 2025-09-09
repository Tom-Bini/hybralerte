import sqlite3
import requests
import certifi
from datetime import datetime, timezone
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "wallets.db")


def fetch_stats(address):
    url = f"https://server.hybra.finance/api/points/user/{address}"
    try:
        response = requests.get(url, headers={"Accept": "*/*"}, verify=certifi.where())
        data = response.json()["data"]
        return data["totalPoints"], data["rank"]
    except Exception as e:
        print(f"❌ Erreur pour {address} : {e}")
        return None, None


def fetch_top_1000_total():
    total = 0
    for page in range(1, 11):
        try:
            res = requests.get(
                f"https://server.hybra.finance/api/points/top/page?current={page}&pageSize=100",
                verify=certifi.where(),  # ✅ correction ajoutée
            )
            records = res.json()["data"]["records"]
            page_total = sum(entry["totalPoints"] for entry in records)
            total += page_total
        except Exception as e:
            print(f"❌ Erreur récupération top 1000 page {page} : {e}")
    return total


def main():
    timestamp = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Table pour les stats individuelles
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS wallet_stats (
            address TEXT,
            total_points REAL,
            rank INTEGER,
            timestamp TEXT,
            PRIMARY KEY (address, timestamp)
        )
    """
    )

    # Table pour le graphique du top 1000
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS top_1000_history (
            timestamp TEXT PRIMARY KEY,
            total_points REAL
        )
    """
    )

    # Mettre à jour chaque wallet enregistré
    c.execute("SELECT address FROM wallets")
    addresses = [row[0] for row in c.fetchall()]

    for address in addresses:
        total_points, rank = fetch_stats(address)
        if total_points is not None and rank is not None:
            c.execute(
                """
                INSERT OR REPLACE INTO wallet_stats (address, total_points, rank, timestamp)
                VALUES (?, ?, ?, ?)
            """,
                (address, total_points, rank, timestamp),
            )
            print(f"✅ {address} → {total_points} pts, rank {rank}")

    # Récupération et insertion des points du top 1000
    total_top_1000 = fetch_top_1000_total()
    c.execute(
        """
        INSERT OR REPLACE INTO top_1000_history (timestamp, total_points)
        VALUES (?, ?)
    """,
        (timestamp, total_top_1000),
    )
    print(f"📊 Total points top 1000 : {total_top_1000:,.0f}")

    conn.commit()
    conn.close()


def fix_permissions():
    try:
        os.chown(DB_PATH, 33, 33)
        os.chmod(DB_PATH, 0o664)

        for ext in [".db-wal", ".db-shm"]:
            path = DB_PATH + ext
            if os.path.exists(path):
                os.chown(path, 33, 33)
                os.chmod(path, 0o664)

        print("🛠️ Permissions corrigées.")
    except Exception as e:
        print(f"⚠️ Impossible de changer les permissions : {e}")


if __name__ == "__main__":
    main()
    fix_permissions()
