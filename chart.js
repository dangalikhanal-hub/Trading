/**
 * MTrade - TradingView Lightweight Charts Integration Module
 * Technical Analysis Indicators:
 * - 50-Period Simple Moving Average (SMA) Line Overlay
 * - Bottom Pane Volume Histogram
 * - UI Toggle Buttons & Crosshair Legend Integration
 */

// ============================================================================
// 1. DATA GENERATORS & MATHEMATICAL INDICATORS
// ============================================================================

/**
 * Generates an array of realistic synthetic OHLC candlestick data.
 * 
 * @param {number} basePrice - Reference price (e.g. 68420.50)
 * @param {number} numBars - Number of candles (default: 150)
 * @param {number} intervalSeconds - Seconds per candle (900 = 15m)
 * @returns {Array<{time: number, open: number, high: number, low: number, close: number}>}
 */
function generateMockOHLCData(basePrice = 68420.50, numBars = 150, intervalSeconds = 900) {
  const ohlcData = [];
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const startTime = nowInSeconds - (numBars * intervalSeconds);
  
  let currentPrice = basePrice * 0.94; // Trend up to basePrice

  for (let i = 0; i < numBars; i++) {
    const time = startTime + (i * intervalSeconds);
    const volatility = currentPrice * (0.004 + Math.random() * 0.005);
    const priceChange = (Math.random() - 0.485) * volatility;
    
    const open = +(currentPrice).toFixed(2);
    const close = +(open + priceChange).toFixed(2);
    
    const upperBody = Math.max(open, close);
    const lowerBody = Math.min(open, close);
    const high = +(upperBody + Math.random() * volatility * 0.6).toFixed(2);
    const low = +(lowerBody - Math.random() * volatility * 0.6).toFixed(2);

    ohlcData.push({ time, open, high, low, close });
    currentPrice = close;
  }

  // Pin final candle to current active market price
  const lastIndex = ohlcData.length - 1;
  ohlcData[lastIndex].close = basePrice;
  if (basePrice > ohlcData[lastIndex].high) ohlcData[lastIndex].high = basePrice;
  if (basePrice < ohlcData[lastIndex].low) ohlcData[lastIndex].low = basePrice;

  return ohlcData;
}

/**
 * Computes a 50-period Simple Moving Average (SMA) from OHLC close prices.
 * 
 * @param {Array<{time: number, close: number}>} candles
 * @param {number} period - Moving average window (default: 50)
 * @returns {Array<{time: number, value: number}>}
 */
function calculateSMA(candles, period = 50) {
  const smaData = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue; // Requires at least 'period' data points
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    smaData.push({
      time: candles[i].time,
      value: +(sum / period).toFixed(2)
    });
  }
  return smaData;
}

/**
 * Generates corresponding Volume data for each candlestick.
 * 
 * @param {Array<{time: number, open: number, close: number}>} candles
 * @returns {Array<{time: number, value: number, color: string}>}
 */
function generateVolumeData(candles) {
  return candles.map(candle => {
    const isBull = candle.close >= candle.open;
    const value = Math.floor(Math.random() * 85 + 15);
    return {
      time: candle.time,
      value: value,
      color: isBull ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)'
    };
  });
}

// ============================================================================
// 2. CHART INITIALIZATION & INDICATOR SERIES
// ============================================================================

/**
 * Mounts the TradingView Lightweight Chart with Candlestick, SMA (50), and Volume.
 * 
 * @param {string|HTMLElement} container - DOM container or ID
 * @param {number} basePrice - Current price
 * @returns {Object} Chart controller with series and toggle handles
 */
function initializeChartWithIndicators(container = 'chart-container', basePrice = 68420.50) {
  const targetElement = typeof container === 'string' ? document.getElementById(container) : container;
  if (!targetElement) {
    throw new Error(`[MTrade Chart] Target container not found: ${container}`);
  }

  targetElement.innerHTML = '';

  // 1. Chart Instance with MTrade Dark Palette
  const chart = LightweightCharts.createChart(targetElement, {
    width: targetElement.clientWidth || 800,
    height: targetElement.clientHeight || 500,
    layout: {
      background: { type: 'solid', color: '#0a0d14' },
      textColor: '#94a3b8',
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace"
    },
    grid: {
      vertLines: { color: 'rgba(30, 40, 61, 0.4)', style: LightweightCharts.LineStyle.SparseDotted },
      horzLines: { color: 'rgba(30, 40, 61, 0.4)', style: LightweightCharts.LineStyle.SparseDotted }
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: '#3b82f6', width: 1, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#1e283d' },
      horzLine: { color: '#3b82f6', width: 1, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#1e283d' }
    },
    rightPriceScale: {
      borderColor: '#1e283d',
      scaleMargins: { top: 0.1, bottom: 0.25 }
    },
    timeScale: {
      borderColor: '#1e283d',
      timeVisible: true,
      secondsVisible: false,
      barSpacing: 8
    }
  });

  // 2. Candlestick Series
  const candleSeries = chart.addCandlestickSeries({
    upColor: '#0ecb81',
    downColor: '#f6465d',
    borderVisible: false,
    wickUpColor: '#0ecb81',
    wickDownColor: '#f6465d'
  });

  // 3. 50-Period Simple Moving Average (SMA) Line Overlay
  const smaSeries = chart.addLineSeries({
    color: '#f59e0b', // Vibrant Gold/Amber line
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: true,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 3,
    title: 'SMA 50'
  });

  // 4. Volume Histogram (scaled to bottom 20% of pane)
  const volumeSeries = chart.addHistogramSeries({
    color: '#3b82f640',
    priceFormat: { type: 'volume' },
    priceScaleId: '', // Overlay on main price scale
    scaleMargins: {
      top: 0.8, // 80% empty above -> volume lives in bottom 20%
      bottom: 0
    }
  });

  // 5. Generate and Set Data
  const candles = generateMockOHLCData(basePrice, 150, 900);
  const smaData = calculateSMA(candles, 50);
  const volumeData = generateVolumeData(candles);

  candleSeries.setData(candles);
  smaSeries.setData(smaData);
  volumeSeries.setData(volumeData);

  chart.timeScale().fitContent();

  // 6. Responsive Resize Observer
  const resizeObserver = new ResizeObserver(entries => {
    if (!entries || !entries.length || !entries[0].contentRect) return;
    const { width, height } = entries[0].contentRect;
    chart.applyOptions({ width, height });
  });
  resizeObserver.observe(targetElement);

  // 7. Indicator Visibility State Controller
  const state = {
    isSmaVisible: true,
    isVolumeVisible: true
  };

  function toggleSMA(visible = null) {
    state.isSmaVisible = visible !== null ? visible : !state.isSmaVisible;
    smaSeries.applyOptions({ visible: state.isSmaVisible });
    return state.isSmaVisible;
  }

  function toggleVolume(visible = null) {
    state.isVolumeVisible = visible !== null ? visible : !state.isVolumeVisible;
    volumeSeries.applyOptions({ visible: state.isVolumeVisible });
    return state.isVolumeVisible;
  }

  return {
    chart,
    candleSeries,
    smaSeries,
    volumeSeries,
    data: { candles, smaData, volumeData },
    toggleSMA,
    toggleVolume,
    getState: () => ({ ...state })
  };
}

// ============================================================================
// 3. UI TOGGLE BUTTONS BINDING
// ============================================================================

/**
 * Attaches event listeners to the indicator toggle buttons in the toolbar.
 * 
 * @param {Object} chartController - Result from initializeChartWithIndicators
 */
function bindIndicatorButtons(chartController) {
  const smaBtn = document.getElementById('toggle-sma-btn');
  const volBtn = document.getElementById('toggle-volume-btn');
  const legendSma = document.getElementById('legend-sma-container');
  const legendVol = document.getElementById('legend-vol-container');

  if (smaBtn) {
    smaBtn.addEventListener('click', () => {
      const isVisible = chartController.toggleSMA();
      if (isVisible) {
        smaBtn.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold transition-all hover:bg-amber-500/20 active:scale-95';
        if (legendSma) legendSma.style.display = 'flex';
      } else {
        smaBtn.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded border border-transparent bg-transparent text-slate-500 hover:text-slate-300 hover:bg-[#171e2e] transition-all active:scale-95';
        if (legendSma) legendSma.style.display = 'none';
      }
    });
  }

  if (volBtn) {
    volBtn.addEventListener('click', () => {
      const isVisible = chartController.toggleVolume();
      if (isVisible) {
        volBtn.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-400 font-semibold transition-all hover:bg-blue-500/20 active:scale-95';
        if (legendVol) legendVol.style.display = 'flex';
      } else {
        volBtn.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded border border-transparent bg-transparent text-slate-500 hover:text-slate-300 hover:bg-[#171e2e] transition-all active:scale-95';
        if (legendVol) legendVol.style.display = 'none';
      }
    });
  }
}

// Global Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateMockOHLCData,
    calculateSMA,
    generateVolumeData,
    initializeChartWithIndicators,
    bindIndicatorButtons
  };
} else {
  window.MTradeChartModule = {
    generateMockOHLCData,
    calculateSMA,
    generateVolumeData,
    initializeChartWithIndicators,
    bindIndicatorButtons
  };
}
