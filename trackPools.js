const API_URL = "https://api.goldsky.com/api/public/project_cmbj707z4cd9901sib1f6cu0c/subgraphs/hybra-v3/v3/gn";

async function fetchPoints(wallet) {
  const res = await fetch(`https://server.hybra.finance/api/points/user/${wallet}`, {
    headers: {
      "Accept": "*/*",
      "Origin": "https://www.hybra.finance",
      "Referer": "https://www.hybra.finance/",
    },
  });

  if (!res.ok) {
    document.getElementById("points").textContent = "⚠️ Erreur lors du chargement des points";
    return;
  }

  const data = await res.json();
  const points = data?.data?.totalPoints ?? 0;

  // Ensuite fetch la diff locale
  try {
    const resDiff = await fetch(`/api/points-diff/${wallet}`);
    const diffData = await resDiff.json();

    const diff = diffData?.diff;
    const diffText = typeof diff === "number"
      ? ` (${diff >= 0 ? "+" : ""}${Math.round(diff).toLocaleString()})`
      : "";

    document.getElementById("points").textContent = `Points : ${points.toLocaleString()}${diffText}`;
  } catch (err) {
    document.getElementById("points").textContent = `Points : ${points.toLocaleString()} (diff. err)`;
  }
}

async function fetchAndDrawHistory(wallet) {
  const res = await fetch(`/api/points-history/${wallet}`);
  const history = await res.json();

  const labels = history.map(entry => new Date(entry.timestamp).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
  const data = history.map(entry => entry.points);

  const ctx = document.getElementById('pointsChart').getContext('2d');
  if (window.pointsChart) window.pointsChart.destroy(); // clear previous chart

  window.pointsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Points',
        data,
        fill: false,
        borderColor: 'blue',
        tension: 0.1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}


async function fetchPositions(wallet) {
  const payload = {
    operationName: "MyPositions",
    variables: {
      where: {
        owner: wallet.toLowerCase(),
        liquidity_gt: "0"
      }
    },
    query: `query MyPositions($where: MyPosition_filter!) {
          myPositions(where: $where) {
            id
            tickLower
            tickUpper
            pool { tick token0 { symbol } token1 { symbol } }
          }
        }`
  };

  const headers = {
    "Content-Type": "application/json",
    "Origin": "https://www.hybra.finance",
    "Referer": "https://www.hybra.finance/"
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data.data?.myPositions || [];
}

function log(text) {
  document.getElementById("log").textContent += text + "\n";
}

function scheduleHourlyPointsUpdate(wallet) {
  async function fetchAndScheduleNext() {
    await fetchPoints(wallet);

    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1);
    next.setMinutes(16);
    next.setSeconds(0);
    next.setMilliseconds(0);

    const delay = next - now;
    setTimeout(fetchAndScheduleNext, delay);
  }

  fetchAndScheduleNext();
}

async function startMonitoring() {
  const wallet = document.getElementById("wallet").value.trim();
  scheduleHourlyPointsUpdate(wallet);
  fetchAndDrawHistory(wallet);
  const sound = document.getElementById("alertSound");

  if (!wallet) {
    alert("Entre une adresse de wallet");
    return;
  }

  setInterval(async () => {
    const positions = await fetchPositions(wallet);
    const now = new Date().toLocaleTimeString();
    const positionsContainer = document.getElementById("positions");
    positionsContainer.innerHTML = `<div style='font-weight:bold;margin-bottom:8px;'>Last update : ${now}</div>`;

    if (positions.length === 0) {
      positionsContainer.innerHTML += `<div class='no-position'>No position found</div>`;
      return;
    }

    for (const pos of positions) {
      const tickLower = parseInt(pos.tickLower);
      const tickUpper = parseInt(pos.tickUpper);
      const currentTick = parseInt(pos.pool.tick);
      const symbol0 = pos.pool.token0.symbol;
      const symbol1 = pos.pool.token1.symbol;
      const poolId = pos.id;
      const percentage = ((currentTick - tickLower) / (tickUpper - tickLower)) * 100;
      const inRange = currentTick >= tickLower && currentTick <= tickUpper;
      const warnNear = document.getElementById("warnNearRange").checked;
      const nearOut = percentage < 10 || percentage > 90;

      const card = document.createElement("div");
      card.className = "position-card" + (inRange ? " in-range" : " out-range");
      card.innerHTML = `
            <div class='pair'><b>${symbol0}/${symbol1}</b> <span class='pool-id'>(id: ${poolId})</span></div>
            <div>Range : <b>${tickLower}</b> → <b>${tickUpper}</b></div>
            <div>Current tick : <b>${currentTick}</b></div>
            <div class='status'>${inRange ? "✅ In range" : "🆘 Out of range"}</div>
          `;
      card.innerHTML += `
        <div class="range-bar">
          <div class="segment red"></div>
          <div class="segment orange"></div>
          <div class="segment green"></div>
          <div class="segment orange"></div>
          <div class="segment red"></div>
          <div class="cursor" style="left: ${Math.max(0, Math.min(10 + (percentage * 0.8), 120))}%"></div>
        </div>
        <a href="https://www.hybra.finance/liquidity/manage/${poolId}" target="_blank" class="position-btn">
          Position
        </a>
      `;
      positionsContainer.appendChild(card);
      if (!inRange || (warnNear && nearOut)) {
        sound.play();
      }
    }
  }, 3000);
}