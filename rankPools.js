async function fetchPoolData() {
  const graphQLEndpoint = "https://api.goldsky.com/api/public/project_cmbj707z4cd9901sib1f6cu0c/subgraphs/hybra-v3/v3/gn";
  const pointsEndpoint = "https://server.hybra.finance/api/points/pool-config/getAllPoolConfigs";

  const graphQLPayload = {
    operationName: "GetV3Pools",
    variables: {
      first: 1000,
      skip: 0,
      where: {},
      orderBy: "totalValueLockedUSD",
      orderDirection: "desc"
    },
    query: `query GetV3Pools($first: Int!, $skip: Int!, $where: Pool_filter, $orderBy: String!, $orderDirection: String!) {
      pools(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
        id
        token0 { symbol }
        token1 { symbol }
        feeTier
        totalValueLockedUSD
        createdAtTimestamp
      }
    }`
  };

  const res1 = await fetch(graphQLEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://www.hybra.finance",
      "Referer": "https://www.hybra.finance/"
    },
    body: JSON.stringify(graphQLPayload)
  });

  const data1 = await res1.json();
  const pools = data1?.data?.pools || [];

  const res2 = await fetch(pointsEndpoint, {
    headers: {
      "Accept": "application/json",
      "Origin": "https://www.hybra.finance",
      "Referer": "https://www.hybra.finance/"
    }
  });

  const boostData = await res2.json();
  const boosts = boostData || [];
  

  const mergedPools = pools.map(pool => {
    const boostEntry = boosts.find(b => b.poolAddress.toLowerCase() === pool.id.toLowerCase());

    return {
      id: pool.id,
      symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
      feeTier: parseInt(pool.feeTier),
      tvlUSD: parseFloat(pool.totalValueLockedUSD),
      createdAt: parseInt(pool.createdAtTimestamp),
      boost: boostEntry?.pointsBoost ?? 0
    };
  });

  const ranked = mergedPools
    .filter(p => p.tvlUSD > 0)
    .map(p => ({
      ...p,
      score: p.boost / p.tvlUSD
    }))
    .sort((a, b) => b.score - a.score);

  console.log("🏆 Pools les plus rentables (boost / TVL) :");
  ranked.forEach(p => {
    console.log(
      `${p.symbol} | Boost: ${p.boost} | TVL: $${p.tvlUSD.toFixed(2)} | Ratio: ${(p.score * 1e6).toFixed(2)} x10⁻⁶`
    );
  });

    const tbody = document.querySelector("#poolTable tbody");
        tbody.innerHTML = ""; // Clear si refresh

        ranked.forEach(p => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${p.symbol}</td>
            <td>${p.boost}</td>
            <td>${p.tvlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td>${(p.score * 1e6).toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById("lastUpdate").textContent =
      "Last update : " + new Date().toLocaleTimeString();

  return ranked;
}

fetchPoolData();

setInterval(fetchPoolData, 60 * 1000);

