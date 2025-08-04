let currentRangePercent = null;

function setRange(percentOrMode) {
    currentRangePercent = percentOrMode;
    updatePoolsTable();

    const label = document.getElementById("selectedRangeLabel");
    if (label) {
        if (percentOrMode === null) {
            label.textContent = "Ranking based on full TVL (no range filter)";
        } else if (percentOrMode === "tick") {
            label.textContent = "Ranking based on TVL in ±1 tick";
        } else {
            label.textContent = `Ranking based on TVL in ±${percentOrMode}% range`;
        }
    }
}

function getCurrentRangePercent() {
    return currentRangePercent;
}

document.getElementById("selectedRangeLabel").textContent =
    "Ranking based on full TVL (no range filter)";
