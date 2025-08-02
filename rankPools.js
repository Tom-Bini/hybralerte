// Fonction pour reconnaître une pool stable
function isStablePool(symbol) {
    const stables = [
        "WHYPE/kHYPE",
        "WHYPE/wstHYPE",
        "USDHL/USD₮0",
        "WHYPE/LHYPE",
        "hbUSDT/USD₮0",
        "USD₮0/USDXL",
        "feUSD/USD₮0",
        "WHYPE/hbHYPE",
        "WHYPE/mHYPE"
    ];
    return stables.some(s => symbol.includes(s));
}

async function updatePoolsTable() {
    console.log("⏳ updatePoolsTable called...");
    const rangePercent = getCurrentRangePercent();

    const graphQLEndpoint = "https://api.goldsky.com/api/public/project_cmbj707z4cd9901sib1f6cu0c/subgraphs/hybra-v3/v3/gn";
    const pointsEndpoint = "https://server.hybra.finance/api/points/pool-config/getAllPoolConfigs";
    const v2Endpoint = "https://api.goldsky.com/api/public/project_cmavyufix18br01tv219kbmxo/subgraphs/hybra-v2/release/gn";
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
          poolHourData(first: 2, orderBy: periodStartUnix, orderDirection: desc) {
            periodStartUnix
            feesUSD
          }
        }
      }
    `
    };

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

    const boostedPairs = [
        "WHYPE/kHYPE",
        "WHYPE/wstHYPE",
        "USDHL/USD₮0",
        "WHYPE/LHYPE",
        "hbUSDT/USD₮0",
        "USD₮0/USDXL",
        "feUSD/USD₮0",
        "WHYPE/hbHYPE",
        "WHYPE/mHYPE"
    ];


    const data1 = await res1.json();
    const pools = data1?.data?.pools || [];

    const boosts = await res2.json();

    const mergedPools = pools.map(pool => {
        const boostEntry = boosts.find(b => b.poolAddress.toLowerCase() === pool.id.toLowerCase());
        const hasBoost = boostedPairs.includes(`${pool.token0.symbol}/${pool.token1.symbol}`);

        const boost = hasBoost ? 3 : 1;
        const tvlUSD = parseFloat(pool.totalValueLockedUSD);
        const ticks = pool.ticks ?? [];

        let proportion = 1;

        if (rangePercent && pool.sqrtPrice) {
            const price = getPriceFromSqrtPriceX96(pool.sqrtPrice);
            const minPrice = price * (1 - rangePercent / 100);
            const maxPrice = price * (1 + rangePercent / 100);
            const tickMin = getTickFromPrice(minPrice);
            const tickMax = getTickFromPrice(maxPrice);

            const sortedTicks = [...ticks].sort((a, b) => parseInt(a.tickIdx) - parseInt(b.tickIdx));

            let activeLiquidity = 0;
            let liqInRange = 0;
            let liqTotal = 0;

            for (const tick of sortedTicks) {
                const tickIdx = parseInt(tick.tickIdx);
                const liqNet = parseFloat(tick.liquidityNet ?? 0);
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

        const feesUSD = pool.poolHourData?.[1]?.feesUSD
            ? parseFloat(pool.poolHourData[1].feesUSD)
            : 0;

        const efficiency = effectiveTVL > 0 ? (feesUSD * boost) / effectiveTVL : 0;

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
            feesUSD,
            effectiveTVL,
            tvlRatio: proportion,
            efficiency,
            token0Address: token0Addr,
            token1Address: token1Addr,
            protocolType
        };
    });

    const totalAll = mergedPools.reduce((sum, p) => sum + p.efficiency, 0);
    const totalStable = mergedPools
        .filter(p => isStablePool(p.symbol))
        .reduce((sum, p) => sum + p.efficiency, 0);

    const efficienciesValues = mergedPools.map(p => p.efficiency).filter(e => e > 0);
    const sortedEff = [...efficienciesValues].sort((a, b) => a - b);
    const medianEff = sortedEff[Math.floor(sortedEff.length / 2)];

    const maxAllowedEff = medianEff * 1000;

    const totalAllFiltered = mergedPools
        .filter(p => p.efficiency <= maxAllowedEff)
        .reduce((sum, p) => sum + p.efficiency, 0);

    mergedPools.forEach(p => {
        let pointsAll;

        pointsAll = totalAllFiltered > 0 ? (p.efficiency / totalAllFiltered) * 100_000 : 0;

        let pointsStable = 0;
        if (isStablePool(p.symbol) && totalStable > 0) {
            pointsStable = (p.efficiency / totalStable) * 10_000;
        }

        p.score = pointsAll + pointsStable;
    });

    const excludeLowTVL = document.getElementById("excludeLowTVL").checked;

    const ranked = mergedPools
        .filter(p => {
            const passesTVL = !excludeLowTVL || p.tvlUSD >= 50000;
            const minFees = parseFloat(document.getElementById("minFees").value) || 0;
            const passesFees = p.feesUSD >= minFees;
            return passesTVL && passesFees && p.score > 0;
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
        <td>x${p.boost}</td>
        <td>${p.feesUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}$</td>
        <td>${p.tvlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}$</td>
        <td>${(p.tvlRatio * 100).toFixed(2)}%</td>
        <td>${(p.score).toFixed(0)}</td>
    `;
        tbody.appendChild(row);
    });

    document.getElementById("lastUpdate").textContent =
        "Last update : " + new Date().toLocaleTimeString();
}

async function fetchAndDrawTop1000History() {
    try {
        const res = await fetch("/api/top1000-history");
        const history = await res.json();

        const labels = history.map(entry => {
            const d = new Date(entry.timestamp);
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
        });

        const data = history.map(entry => entry.points);

        const ctx = document.getElementById('top1000Chart').getContext('2d');

        if (window.top1000Chart && typeof window.top1000Chart.destroy === 'function') {
            window.top1000Chart.destroy();
        }

        window.top1000Chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Cumulated points of top 1000',
                    data,
                    borderColor: 'green',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function (value) {
                                return (value / 1_000_000).toLocaleString() + ' M';
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                }
            }
        });
    } catch (err) {
        console.error("Erreur fetch top1000History :", err);
    }
}


fetchAndDrawTop1000History();
setInterval(fetchAndDrawTop1000History, 60 * 60 * 1000); // maj toutes les heures


// Appels initiaux
updatePoolsTable();
setInterval(updatePoolsTable, 60 * 1000);

// Export global pour rangeSwitcher
window.updatePoolsTable = updatePoolsTable;
