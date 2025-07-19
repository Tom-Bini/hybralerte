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
    document.getElementById("points").textContent = `Points : ${points.toLocaleString()}`;
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
      const sound = document.getElementById("alertSound");

      if (!wallet) {
        alert("Entre une adresse de wallet");
        return;
      }

      setInterval(async () => {
        const positions = await fetchPositions(wallet);
        const now = new Date().toLocaleTimeString();
        document.getElementById("log").textContent = `--------------- ${now} ---------------\n`;

        for (const pos of positions) {
          const tickLower = parseInt(pos.tickLower);
          const tickUpper = parseInt(pos.tickUpper);
          const currentTick = parseInt(pos.pool.tick);
          const symbol0 = pos.pool.token0.symbol;
          const symbol1 = pos.pool.token1.symbol;
          const poolId = pos.id;

          const percentage = ((currentTick - tickLower) / (tickUpper - tickLower)) * 100;
          log(`Pool : ${symbol0}/${symbol1} (id : ${poolId})`);
          log(`Range : ${tickLower} → ${tickUpper}`);
          log(`Current tick : ${currentTick} (${Math.round(percentage)}% of the range)`);

          if (currentTick >= tickLower && currentTick <= tickUpper) {
            log("✅ Pool in range\n");
          } else {
            log("🆘 Pool out of range\n");
            sound.play();
          }
        }
      }, 3000);
    }