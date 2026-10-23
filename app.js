/**
 * MTrade - Modern Crypto & Fintech Dashboard
 * Features:
 * - Interactive Bézier mountain area chart with crosshair tooltip pin
 * - Dynamic coin data (Bitcoin, Metadium, Electroneum, Utrust, etc.)
 * - Reactive Buy / Sell / Swap calculator
 * - Timeframe filters & real-time price updates
 */

// ============================================================================
// 1. DATA MODELS
// ============================================================================
const COINS_DATA = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    iconSymbol: '₿',
    iconBg: '#f7931a',
    price: 114884.00,
    changePrice: 2401.23,
    changePercent: 4.61,
    isUp: true,
    supply: '~19.91M BTC',
    mcap: '$2.27 T',
    fdv: '$2.39 T',
    volume: '$70.7 B',
    about: 'Bitcoin is one of the most popular cryptocurrencies in the market. First introduced in 2009 by Satoshi Nakamoto, Bitcoin continues to be the top cryptocurrency by market capitalization. Bitcoin paved the way for many existing altcoins in the market and marked a pivotal moment for digital payment solutions. Bitcoin recorded a new all-time high of $114,970, pushing the crypto market capitalization to an impressive $3.5 trillion.',
    chartPoints: [
      { time: '10:00 AM', date: 'Nov 12, 2024', val: 26500 },
      { time: '10:10 AM', date: 'Nov 12, 2024', val: 28200 },
      { time: '10:20 AM', date: 'Nov 12, 2024', val: 27100 },
      { time: '10:30 AM', date: 'Nov 12, 2024', val: 32400 },
      { time: '10:45 AM', date: 'Nov 12, 2024', val: 30500 },
      { time: '11:00 AM', date: 'Nov 12, 2024', val: 38900 },
      { time: '11:15 AM', date: 'Nov 12, 2024', val: 36800 },
      { time: '11:30 AM', date: 'Nov 12, 2024', val: 40200 },
      { time: '11:45 AM', date: 'Nov 12, 2024', val: 37400 },
      { time: '12:00 PM', date: 'Nov 12, 2024', val: 35752.21, pinDefault: true },
      { time: '12:15 PM', date: 'Nov 12, 2024', val: 39500 },
      { time: '12:30 PM', date: 'Nov 12, 2024', val: 38200 },
      { time: '12:45 PM', date: 'Nov 12, 2024', val: 43800 },
      { time: '01:00 PM', date: 'Nov 12, 2024', val: 42100 },
      { time: '01:15 PM', date: 'Nov 12, 2024', val: 44200 }
    ]
  },
  META: {
    name: 'Metadium',
    symbol: 'META',
    iconSymbol: 'M',
    iconBg: '#111827',
    price: 0.0205,
    changePrice: 0.0061,
    changePercent: 42.33,
    isUp: true,
    supply: '~1.70B META',
    mcap: '$34.8 M',
    fdv: '$41.0 M',
    volume: '$12.4 M',
    about: 'Metadium is an identity blockchain platform built on a decentralized identity (DID) standard. Designed for trustless verification, Metadium allows users to manage and own their personal digital identities securely.',
    chartPoints: [
      { time: '10:00 AM', date: 'Nov 12, 2024', val: 0.0140 },
      { time: '10:30 AM', date: 'Nov 12, 2024', val: 0.0152 },
      { time: '11:00 AM', date: 'Nov 12, 2024', val: 0.0175 },
      { time: '11:30 AM', date: 'Nov 12, 2024', val: 0.0168 },
      { time: '12:00 PM', date: 'Nov 12, 2024', val: 0.0195, pinDefault: true },
      { time: '12:30 PM', date: 'Nov 12, 2024', val: 0.0189 },
      { time: '01:00 PM', date: 'Nov 12, 2024', val: 0.0205 }
    ]
  },
  ETN: {
    name: 'Electroneum',
    symbol: 'ETN',
    iconSymbol: '⚡',
    iconBg: '#0284c7',
    price: 0.1406,
    changePrice: 0.0325,
    changePercent: 30.23,
    isUp: true,
    supply: '~17.9B ETN',
    mcap: '$251.2 M',
    fdv: '$295.0 M',
    volume: '$48.1 M',
    about: 'Electroneum is a portable mobile-first cryptocurrency ecosystem designed to unlock digital micropayments and financial inclusion across emerging markets worldwide.',
    chartPoints: [
      { time: '10:00 AM', date: 'Nov 12, 2024', val: 0.105 },
      { time: '10:30 AM', date: 'Nov 12, 2024', val: 0.118 },
      { time: '11:00 AM', date: 'Nov 12, 2024', val: 0.124 },
      { time: '11:30 AM', date: 'Nov 12, 2024', val: 0.132 },
      { time: '12:00 PM', date: 'Nov 12, 2024', val: 0.129, pinDefault: true },
      { time: '12:30 PM', date: 'Nov 12, 2024', val: 0.138 },
      { time: '01:00 PM', date: 'Nov 12, 2024', val: 0.1406 }
    ]
  },
  UTK: {
    name: 'Utrust',
    symbol: 'UTK',
    iconSymbol: 'U',
    iconBg: '#7c3aed',
    price: 1.0205,
    changePrice: 0.1110,
    changePercent: 12.24,
    isUp: true,
    supply: '~500.0M UTK',
    mcap: '$510.2 M',
    fdv: '$510.2 M',
    volume: '$29.5 M',
    about: 'Utrust (xMoney) is a cryptocurrency payment solution providing modern merchants with instantaneous crypto-to-fiat settlements with consumer purchase protection.',
    chartPoints: [
      { time: '10:00 AM', date: 'Nov 12, 2024', val: 0.890 },
      { time: '10:30 AM', date: 'Nov 12, 2024', val: 0.925 },
      { time: '11:00 AM', date: 'Nov 12, 2024', val: 0.960 },
      { time: '11:30 AM', date: 'Nov 12, 2024', val: 0.945 },
      { time: '12:00 PM', date: 'Nov 12, 2024', val: 0.995, pinDefault: true },
      { time: '12:30 PM', date: 'Nov 12, 2024', val: 1.010 },
      { time: '01:00 PM', date: 'Nov 12, 2024', val: 1.0205 }
    ]
  }
};

const TOP_MOVERS = [
  { rank: 1, key: 'META', name: 'Metadium', symbol: 'META', icon: 'M', iconBg: 'bg-[#181a20]', price: '$0.0205', change: '+42.33%' },
  { rank: 2, key: 'ETN', name: 'Electroneum', symbol: 'ETN', icon: '⚡', iconBg: 'bg-[#0284c7]', price: '$0.1406', change: '+30.23%' },
  { rank: 3, key: 'UTK', name: 'Utrust', symbol: 'UTK', icon: 'U', iconBg: 'bg-[#7c3aed]', price: '$1.0205', change: '+12.24%' },
  { rank: 4, key: 'META', name: 'Metadium', symbol: 'META', icon: 'M', iconBg: 'bg-[#181a20]', price: '$0.2305', change: '+56.63%' }
];

let activeCoinKey = 'BTC';
let activeTimeframe = '1D';
let activeOrderMode = 'buy';
let chartCoordinates = [];

// ============================================================================
// 2. INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  renderTopMovers();
  updateCoinDetailsView(activeCoinKey);
  setupInteractiveChart();
  setupOrderForm();
  setupTimeframeButtons();
  setupSearch();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// ============================================================================
// 3. COIN DETAILS & HEADER RENDERER
// ============================================================================
function updateCoinDetailsView(coinKey) {
  const coin = COINS_DATA[coinKey] || COINS_DATA.BTC;
  activeCoinKey = coinKey;

  // Title & Symbol
  document.getElementById('coin-title').textContent = coin.name;
  document.getElementById('coin-symbol').textContent = coin.symbol;
  
  const avatar = document.getElementById('coin-avatar');
  avatar.textContent = coin.iconSymbol;
  avatar.style.backgroundColor = coin.iconBg;

  // Price & Trend Badge
  const priceFormatted = coin.price >= 1 ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : coin.price.toFixed(4);
  document.getElementById('display-price').textContent = `$${priceFormatted}`;

  const changeText = document.getElementById('display-change-text');
  changeText.textContent = `+${coin.changePrice.toLocaleString('en-US')} (${coin.changePercent.toFixed(2)}%)`;

  // Stats
  document.getElementById('stat-supply').textContent = coin.supply;
  document.getElementById('stat-mcap').textContent = coin.mcap;
  document.getElementById('stat-fdv').textContent = coin.fdv;
  document.getElementById('stat-volume').textContent = coin.volume;

  // About Section
  document.getElementById('about-heading').textContent = `About ${coin.name}`;
  document.getElementById('about-text').textContent = coin.about;

  // Update Exchange Rate in Order Panel
  const rateText = document.getElementById('dynamic-rate-text');
  if (rateText) {
    rateText.textContent = `${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  }

  // Recalculate buying/spending defaults
  const buyInput = document.getElementById('input-buy-amount');
  const spendInput = document.getElementById('input-spending-amount');
  if (buyInput && spendInput) {
    const buyVal = parseFloat(buyInput.value) || 0.01;
    spendInput.value = (buyVal * coin.price).toFixed(2);
  }

  // Re-draw chart for selected coin
  drawSmoothChart(coin.chartPoints);
}

// ============================================================================
// 4. TOP MOVERS LIST RENDERER
// ============================================================================
function renderTopMovers() {
  const container = document.getElementById('top-movers-container');
  if (!container) return;

  container.innerHTML = TOP_MOVERS.map((item, idx) => `
    <div class="top-mover-item flex items-center justify-between py-3 px-1 rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${item.key === activeCoinKey ? 'bg-emerald-50/60' : ''}" data-key="${item.key}">
      <!-- Left: Rank + Icon + Names -->
      <div class="flex items-center space-x-3.5">
        <span class="text-xs font-bold text-gray-400 w-3">${item.rank}</span>
        <div class="w-8 h-8 rounded-full ${item.iconBg} flex items-center justify-center text-white font-bold text-xs shadow-sm">
          ${item.icon}
        </div>
        <div>
          <div class="text-xs font-extrabold text-[#111827]">${item.name}</div>
          <div class="text-[10px] font-bold text-gray-400 uppercase">${item.symbol}</div>
        </div>
      </div>

      <!-- Right: Price + Gain -->
      <div class="text-right">
        <div class="text-xs font-bold text-[#111827] font-mono-numbers">${item.price}</div>
        <div class="text-[11px] font-bold text-[#00c076] font-mono-numbers flex items-center justify-end space-x-0.5">
          <span>▲</span>
          <span>${item.change.replace('+', '')}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Attach click listener to switch active coin
  container.querySelectorAll('.top-mover-item').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.getAttribute('data-key');
      updateCoinDetailsView(key);
      renderTopMovers();
      showToast(`Switched view to ${COINS_DATA[key]?.name || key}`);
    });
  });
}

// ============================================================================
// 5. INTERACTIVE BÉZIER AREA CHART (Pixel-Perfect Smooth Mountain Curve)
// ============================================================================
function drawSmoothChart(points) {
  const wrapper = document.getElementById('chart-area-wrapper');
  const svg = document.getElementById('svg-chart');
  const linePath = document.getElementById('chart-line-path');
  const areaPath = document.getElementById('chart-area-path');

  if (!wrapper || !svg || !linePath || !areaPath || !points || points.length < 2) return;

  const width = wrapper.clientWidth - 50; // Leave margin for right price labels
  const height = wrapper.clientHeight - 30; // Leave margin for bottom time labels
  const topPadding = 15;
  const bottomPadding = 30;

  // Find min & max
  const values = points.map(p => p.val);
  const minVal = Math.min(...values) * 0.92;
  const maxVal = Math.max(...values) * 1.05;
  const valRange = maxVal - minVal || 1;

  // Calculate coordinates (X, Y)
  chartCoordinates = points.map((p, i) => {
    const x = 10 + (i / (points.length - 1)) * (width - 20);
    const normalizedY = (p.val - minVal) / valRange;
    const y = height - bottomPadding - (normalizedY * (height - topPadding - bottomPadding));
    return { ...p, x, y };
  });

  // Build Cardinal/Cubic Spline Path
  const lineD = createSmoothPath(chartCoordinates);
  linePath.setAttribute('d', lineD);

  // Closed Area Path (down to baseline)
  const first = chartCoordinates[0];
  const last = chartCoordinates[chartCoordinates.length - 1];
  const baselineY = height - bottomPadding + 10;
  const areaD = `${lineD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  areaPath.setAttribute('d', areaD);

  // Pin default tooltip (Nov 12, 2024 at default point)
  const defaultPinIndex = chartCoordinates.findIndex(p => p.pinDefault);
  const pinTarget = defaultPinIndex !== -1 ? chartCoordinates[defaultPinIndex] : chartCoordinates[Math.floor(chartCoordinates.length * 0.62)];
  positionTooltipPin(pinTarget);
}

function createSmoothPath(points) {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 5.5;
    const cp1y = p1.y + (p2.y - p0.y) / 5.5;
    const cp2x = p2.x - (p3.x - p1.x) / 5.5;
    const cp2y = p2.y - (p3.y - p1.y) / 5.5;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function setupInteractiveChart() {
  const wrapper = document.getElementById('chart-area-wrapper');
  if (!wrapper) return;

  wrapper.addEventListener('mousemove', (e) => {
    if (!chartCoordinates.length) return;
    const rect = wrapper.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find nearest data point
    let closest = chartCoordinates[0];
    let minDiff = Infinity;
    chartCoordinates.forEach(pt => {
      const diff = Math.abs(pt.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    });

    positionTooltipPin(closest);
  });

  // Resize handler
  window.addEventListener('resize', () => {
    const coin = COINS_DATA[activeCoinKey] || COINS_DATA.BTC;
    drawSmoothChart(coin.chartPoints);
  });
}

function positionTooltipPin(point) {
  const pin = document.getElementById('chart-pin');
  const dot = document.getElementById('pin-dot');
  const box = document.getElementById('pin-box');
  const dateEl = document.getElementById('pin-date');
  const priceEl = document.getElementById('pin-price');

  if (!pin || !point) return;

  pin.classList.remove('hidden');
  pin.style.transform = `translateX(${point.x}px)`;

  if (dot) dot.style.top = `${point.y}px`;
  if (box) box.style.top = `${point.y}px`;

  if (dateEl) dateEl.textContent = point.date || 'Nov 12, 2024';
  if (priceEl) {
    const pFormatted = point.val >= 1 ? point.val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : point.val.toFixed(4);
    priceEl.textContent = `$${pFormatted}`;
  }
}

// ============================================================================
// 6. ORDER FORM (BUY / SELL / SWAP DYNAMICS)
// ============================================================================
function setupOrderForm() {
  // Mode Switcher Tabs (Buy / Sell / Swap)
  document.querySelectorAll('.order-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-mode-btn').forEach(b => {
        b.className = 'order-mode-btn py-2 rounded-xl text-gray-500 hover:text-black transition-all';
      });
      btn.className = 'order-mode-btn active py-2 rounded-xl bg-white text-[#111827] shadow-sm font-bold transition-all';
      activeOrderMode = btn.getAttribute('data-mode');

      const label = document.getElementById('buying-label');
      const submitBtn = document.getElementById('order-continue-btn');
      if (activeOrderMode === 'buy') {
        if (label) label.textContent = "I'm Buying";
        if (submitBtn) submitBtn.innerHTML = `<span>Continue</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
      } else if (activeOrderMode === 'sell') {
        if (label) label.textContent = "I'm Selling";
        if (submitBtn) submitBtn.innerHTML = `<span>Sell Now</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
      } else {
        if (label) label.textContent = "You Swap";
        if (submitBtn) submitBtn.innerHTML = `<span>Swap Now</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
      }
      if (window.lucide) window.lucide.createIcons();
    });
  });

  // Amount Inputs Calculation Sync
  const buyInput = document.getElementById('input-buy-amount');
  const spendInput = document.getElementById('input-spending-amount');

  buyInput?.addEventListener('input', () => {
    const coin = COINS_DATA[activeCoinKey] || COINS_DATA.BTC;
    const amount = parseFloat(buyInput.value) || 0;
    spendInput.value = (amount * coin.price).toFixed(2);
  });

  spendInput?.addEventListener('input', () => {
    const coin = COINS_DATA[activeCoinKey] || COINS_DATA.BTC;
    const spend = parseFloat(spendInput.value) || 0;
    buyInput.value = coin.price > 0 ? (spend / coin.price).toFixed(4) : 0;
  });

  // Continue Button Submission
  document.getElementById('order-continue-btn')?.addEventListener('click', () => {
    const coin = COINS_DATA[activeCoinKey] || COINS_DATA.BTC;
    const amount = buyInput?.value || '0.01';
    const total = spendInput?.value || '432.51';
    showToast(`Order Initiated: ${activeOrderMode.toUpperCase()} ${amount} ${coin.symbol} ($${total} USD)`);
  });
}

// ============================================================================
// 7. TIMEFRAME BUTTONS
// ============================================================================
function setupTimeframeButtons() {
  document.querySelectorAll('.tf-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-pill').forEach(b => {
        b.className = 'tf-pill px-3 py-1.5 rounded-lg hover:text-black transition-all';
      });
      btn.className = 'tf-pill px-3 py-1.5 rounded-lg bg-[#00c076] text-white shadow-sm font-extrabold';
      activeTimeframe = btn.getAttribute('data-tf');
      
      // Simulate timeframe variation in chart points
      const coin = COINS_DATA[activeCoinKey] || COINS_DATA.BTC;
      const modifiedPoints = coin.chartPoints.map((p, idx) => ({
        ...p,
        val: +(p.val * (1 + (Math.sin(idx + Date.now() / 1000) * 0.04))).toFixed(2)
      }));
      drawSmoothChart(modifiedPoints);
      showToast(`Timeframe switched to ${activeTimeframe}`);
    });
  });
}

// ============================================================================
// 8. SEARCH & TOAST HELPERS
// ============================================================================
function setupSearch() {
  const searchInput = document.getElementById('global-search-input');
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim().toUpperCase();
      if (COINS_DATA[q]) {
        updateCoinDetailsView(q);
        showToast(`Loaded ${COINS_DATA[q].name}`);
      } else {
        showToast(`No match for "${searchInput.value}" - showing Bitcoin`);
        updateCoinDetailsView('BTC');
      }
    }
  });
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-notice flex items-center space-x-2.5 bg-[#181a20] text-white px-4 py-3 rounded-2xl shadow-xl border border-gray-700/50 text-xs font-semibold';
  toast.innerHTML = `
    <div class="w-2 h-2 rounded-full bg-[#00c076] animate-pulse"></div>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}
