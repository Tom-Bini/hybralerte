// rangeSwitcher.js

let currentRangePercent = null; // null = Full range

function setRange(percent) {
  currentRangePercent = percent;
  updatePoolsTable(); // fournie par rankPools.js
}

function getCurrentRangePercent() {
  return currentRangePercent;
}