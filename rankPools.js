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
          sqrtPrice
          ticks(first: 1000) {
            tickIdx
            liquidityGross
            liquidityNet
          }
        }
      }
    `
    };

    // Helpers
    const getPriceFromSqrtPriceX96 = (sqrtX96) => {
        return (parseFloat(sqrtX96) / (2 ** 96)) ** 2;
    };

    const getTickFromPrice = (price) => {
        return Math.floor(Math.log(price) / Math.log(1.0001));
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
    const pools = data1?.data?.pools || [];
    const boosts = await res2.json();

    const mergedPools = pools.map(pool => {
        const boostEntry = boosts.find(b => b.poolAddress.toLowerCase() === pool.id.toLowerCase());
        const boost = boostEntry?.pointsBoost ?? 0;
        const tvlUSD = parseFloat(pool.totalValueLockedUSD);
        const ticks = pool.ticks ?? [];

        let proportion = 1;

        if (rangePercent && pool.sqrtPrice) {
            const price = getPriceFromSqrtPriceX96(pool.sqrtPrice);
            const minPrice = price * (1 - rangePercent / 100);
            const maxPrice = price * (1 + rangePercent / 100);
            const tickMin = getTickFromPrice(minPrice);
            const tickMax = getTickFromPrice(maxPrice);

            // On suppose maintenant que `liquidityNet` est bien présent dans les ticks
            const sortedTicks = [...ticks].sort((a, b) => parseInt(a.tickIdx) - parseInt(b.tickIdx));

            let activeLiquidity = 0;
            let liqInRange = 0;
            let liqTotal = 0;

            for (const tick of sortedTicks) {
                const tickIdx = parseInt(tick.tickIdx);
                const liqNet = parseFloat(tick.liquidityNet ?? 0);  // <= il faut que ta requête GraphQL inclue ce champ maintenant
                activeLiquidity += liqNet;

                const liqAbs = Math.abs(activeLiquidity);
                liqTotal += liqAbs;

                if (tickIdx >= tickMin && tickIdx <= tickMax) {
                    liqInRange += liqAbs;
                }
            }

            proportion = liqTotal > 0 ? liqInRange / liqTotal : 0;
        }


        const effectiveTVL = tvlUSD * proportion;
        const score = effectiveTVL > 0 ? boost / effectiveTVL : 0;

        const token0Addr = boostEntry?.token0Address;
        const token1Addr = boostEntry?.token1Address;
        const protocolType = boostEntry?.protocolType ?? "v3";
        const fee = boostEntry?.feeTier;

        return {
            id: pool.id,
            symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
            feeTier: parseInt(pool.feeTier),
            tvlUSD,
            boost,
            effectiveTVL,
            tvlRatio: proportion,
            score,
            token0Address: token0Addr,
            token1Address: token1Addr,
            protocolType
        };
    });

    const excludeLowTVL = document.getElementById("excludeLowTVL").checked;

    const ranked = mergedPools
        .filter(p => {
            const passesTVL = !excludeLowTVL || p.tvlUSD >= 50000;
            return passesTVL && p.score > 0;
        })
        .sort((a, b) => b.score - a.score);


    const tbody = document.querySelector("#poolTable tbody");
    tbody.innerHTML = "";

    ranked.forEach((p, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="pair-cell">
                <a href="https://www.hybra.finance/liquidity/add?token0=${p.token0Address}&token1=${p.token1Address}&fee=${p.feeTier}&type=${p.protocolType}" target="_blank" class="pair-name">${p.symbol}</a>
                <a href="https://dexscreener.com/hyperevm/${p.id}" target="_blank" class="chart-link">
                <img src="dexscreener-icon.png" alt="Chart" class="chart-icon" />
                </a>
            </td>
            <td>${p.boost}</td>
            <td>${p.tvlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td>${(p.tvlRatio * 100).toFixed(2)}%</td>
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
