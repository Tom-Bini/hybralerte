async function updatePoolsTable() {
    console.log("⏳ updatePoolsTable called...");
    const rangePercent = getCurrentRangePercent();

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
        query: `
      query GetV3Pools($first: Int!, $skip: Int!, $where: Pool_filter, $orderBy: String!, $orderDirection: String!) {
        pools(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
          id
          token0 { symbol id }
          token1 { symbol id }
          feeTier
          totalValueLockedUSD
          tick
          ticks(first: 1000) {
            tickIdx
            liquidityGross
          }
        }
      }
    `
    };

    const [res1, res2] = await Promise.all([
        fetch(graphQLEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": "https://www.hybra.finance",
                "Referer": "https://www.hybra.finance/"
            },
            body: JSON.stringify(graphQLPayload)
        }),
        fetch(pointsEndpoint, {
            headers: {
                "Accept": "application/json",
                "Origin": "https://www.hybra.finance",
                "Referer": "https://www.hybra.finance/"
            }
        })
    ]);

    const data1 = await res1.json();
    console.log("📦 GraphQL data:", data1);
    const pools = data1?.data?.pools || [];
    const boosts = await res2.json();
    console.log("📦 Boosts data:", boosts);

    const mergedPools = pools.map(pool => {
        const boostEntry = boosts.find(b => b.poolAddress.toLowerCase() === pool.id.toLowerCase());
        const boost = boostEntry?.pointsBoost ?? 0;
        const tvlUSD = parseFloat(pool.totalValueLockedUSD);
        const currentTick = parseInt(pool.tick);
        const ticks = pool.ticks ?? [];

        // Si plage définie, calcule la proportion de liquidityGross dans la range
        let effectiveTVL = tvlUSD;

        if (rangePercent) {
            const tickRange = Math.round(Math.abs(currentTick) * (rangePercent / 100));
            const tickMin = currentTick - tickRange;
            const tickMax = currentTick + tickRange;

            const liqInRange = ticks
                .filter(t => {
                    const tickIdx = parseInt(t.tickIdx);
                    return tickIdx >= tickMin && tickIdx <= tickMax;
                })
                .reduce((sum, t) => sum + parseFloat(t.liquidityGross || 0), 0);

            const liqTotal = ticks
                .reduce((sum, t) => sum + parseFloat(t.liquidityGross || 0), 0);

            const proportion = liqTotal > 0 ? liqInRange / liqTotal : 0;
            effectiveTVL = tvlUSD * proportion;
        }

        const score = effectiveTVL > 0 ? boost / effectiveTVL : 0;

        const token0Addr = boostEntry?.token0Address;
        const token1Addr = boostEntry?.token1Address;
        const protocolType = boostEntry?.protocolType ?? "v3";
        const fee = boostEntry?.feeTier;

        const poolUrl = token0Addr && token1Addr && fee
            ? `https://www.hybra.finance/liquidity/add?token0=${token0Addr}&token1=${token1Addr}&fee=${fee}&type=${protocolType}`
            : null;

        return {
            id: pool.id,
            symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
            feeTier: parseInt(pool.feeTier),
            tvlUSD,
            boost,
            effectiveTVL,
            score,
            token0Address: boostEntry?.token0Address,
            token1Address: boostEntry?.token1Address,
            protocolType: boostEntry?.protocolType
        };
    });

    const ranked = mergedPools
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);

    const tbody = document.querySelector("#poolTable tbody");
    tbody.innerHTML = "";

    ranked.forEach(p => {
        const tvl = rangePercent ? p.effectiveTVL : p.tvlUSD;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td><a href="https://www.hybra.finance/liquidity/add?token0=${p.token0Address}&token1=${p.token1Address}&fee=${p.feeTier}&type=${p.protocolType}" target="_blank">${p.symbol}</a></td>
      <td>${p.boost}</td>
      <td>${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
      <td>${(p.score * 1e6).toFixed(2)}</td>
    `;
        tbody.appendChild(row);
    });

    document.getElementById("lastUpdate").textContent =
        "Last update : " + new Date().toLocaleTimeString();
}

// Appels initiaux
updatePoolsTable();
setInterval(updatePoolsTable, 60 * 1000);

// Export global pour rangeSwitcher
window.updatePoolsTable = updatePoolsTable;
