const API_URL = "https://api.goldsky.com/api/public/project_cmbj707z4cd9901sib1f6cu0c/subgraphs/hybra-v3/v3/gn";

// 🔧 Fonction principale
export async function getActiveLiquidity(poolAddress) {
  // Étape 1 – Obtenir le tick actuel
  const tickQuery = {
    query: `
      query {
        pool(id: "${poolAddress.toLowerCase()}") {
          tick
        }
      }
    `
  };

  const tickRes = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tickQuery)
  });

  const tickData = await tickRes.json();
  const currentTick = parseInt(tickData?.data?.pool?.tick);

  if (isNaN(currentTick)) {
    console.error("❌ Tick non trouvé");
    return null;
  }

  // Étape 2 – Définir le range ±2%
  const delta = Math.round(currentTick * 0.02);
  const minTick = currentTick - delta;
  const maxTick = currentTick + delta;

  // Étape 3 – Récupérer les ticks dans le range
  const ticksQuery = {
    query: `
      query {
        pool(id: "${poolAddress.toLowerCase()}") {
          ticks(
            where: { tickIdx_gte: ${minTick}, tickIdx_lte: ${maxTick} },
            orderBy: tickIdx,
            orderDirection: asc
          ) {
            tickIdx
            liquidityGross
          }
        }
      }
    `
  };

  const ticksRes = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticksQuery)
  });

  const ticksData = await ticksRes.json();
  const ticks = ticksData?.data?.pool?.ticks || [];

  // Étape 4 – Somme de la liquidité active
  const totalActiveLiquidity = ticks.reduce((sum, tick) => {
    return sum + BigInt(tick.liquidityGross);
  }, 0n);

  return {
    currentTick,
    minTick,
    maxTick,
    activeLiquidity: totalActiveLiquidity.toString(), // string pour l'affichage
    ticksInRange: ticks.length
  };
}
