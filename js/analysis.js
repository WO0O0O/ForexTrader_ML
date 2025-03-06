/**
 * GBP/USD Forex Trader - Trading Analysis Module
 * 
 * This module implements various trading strategies and technical indicators
 * to generate buy/sell signals for the GBP/USD currency pair.
 */

class ForexTradingAnalysis {
  constructor() {
    this.isInitialized = false;
    this.currentRate = null;
    this.data = null;
    this.historyLength = 100; // days of history to load
  }
  
  /**
   * Initialize the trading analysis system
   */
  async initialize() {
    console.log('Initializing trading analysis...');
    
    try {
      // Load historical data
      await this.loadHistoricalData();
      
      // Get current rate
      await this.getCurrentRate();
      
      this.isInitialized = true;
      console.log('Trading analysis initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize trading analysis:', error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Load historical data for GBP/USD
   */
  async loadHistoricalData() {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.historyLength);
      
      // Format dates for Yahoo Finance API
      const startPeriod = Math.floor(startDate.getTime() / 1000);
      const endPeriod = Math.floor(endDate.getTime() / 1000);
      
      // Fetch historical data from Yahoo Finance
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/GBPUSD=X?period1=${startPeriod}&period2=${endPeriod}&interval=1d`
      );
      
      const result = await response.json();
      
      if (!result || !result.chart || !result.chart.result || !result.chart.result[0]) {
        throw new Error('Invalid data format from Yahoo Finance API');
      }
      
      const quotes = result.chart.result[0];
      
      if (!quotes.timestamp || !quotes.indicators || !quotes.indicators.quote || !quotes.indicators.quote[0]) {
        throw new Error('Missing data from Yahoo Finance API');
      }
      
      const timestamps = quotes.timestamp;
      const quoteData = quotes.indicators.quote[0];
      
      // Extract OHLCV data
      this.data = {
        date: timestamps.map(timestamp => new Date(timestamp * 1000)),
        open: quoteData.open,
        high: quoteData.high,
        low: quoteData.low,
        close: quoteData.close,
        volume: quoteData.volume
      };
      
      console.log(`Successfully loaded ${this.data.close.length} days of historical data`);
      return true;
    } catch (error) {
      console.error('Error loading historical data:', error);
      throw new Error(`Failed to load historical data: ${error.message}`);
    }
  }
  
  /**
   * Get current forex rate for GBP/USD
   */
  async getCurrentRate() {
    try {
      // Using Yahoo Finance API
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GBPUSD=X?interval=1d&range=1d`);
      const data = await response.json();
      
      if (!data || !data.chart || !data.chart.result || !data.chart.result[0] || 
          !data.chart.result[0].meta || !data.chart.result[0].meta.regularMarketPrice) {
        throw new Error("Invalid data format from Yahoo Finance API");
      }
      
      this.currentRate = data.chart.result[0].meta.regularMarketPrice;
      return this.currentRate;
    } catch (error) {
      console.error("Error fetching current rate:", error);
      
      // Fallback to most recent value from historical data if available
      if (this.data && this.data.close && this.data.close.length > 0) {
        this.currentRate = this.data.close[this.data.close.length - 1];
        return this.currentRate;
      }
      
      throw error;
    }
  }
  
  /**
   * Get latest trading signal based on selected model
   */
  async getSignal(modelType = 'ensemble') {
    if (!this.isInitialized || !this.data) {
      await this.initialize();
    }
    
    try {
      let signal = 0;
      let strength = 0;
      let details = {};
      
      // Technical analysis
      const rsiSignal = this.rsiStrategy();
      const macdSignal = this.macdStrategy();
      const maCrossSignal = this.movingAverageCrossover();
      const bbandsSignal = this.bollingerBandsStrategy();
      
      details = {
        rsi: rsiSignal,
        macd: macdSignal,
        maCross: maCrossSignal,
        bollinger: bbandsSignal
      };
      
      // Determine overall signal based on model type
      switch (modelType) {
        case 'technical':
          // Simple average of technical indicators
          signal = (rsiSignal.signal + macdSignal.signal + maCrossSignal.signal + bbandsSignal.signal) / 4;
          strength = Math.abs(signal) * 100;
          break;
          
        case 'ml':
          // Placeholder for ML model (would need a proper implementation)
          // For now, weight technical indicators differently
          signal = (rsiSignal.signal * 0.3 + macdSignal.signal * 0.3 + 
                   maCrossSignal.signal * 0.2 + bbandsSignal.signal * 0.2);
          strength = Math.abs(signal) * 100;
          break;
          
        case 'ensemble':
        default:
          // Ensemble approach - count number of agreeing signals
          const signals = [rsiSignal.signal, macdSignal.signal, maCrossSignal.signal, bbandsSignal.signal];
          const positiveCount = signals.filter(s => s > 0).length;
          const negativeCount = signals.filter(s => s < 0).length;
          
          if (positiveCount > negativeCount) {
            signal = 1;
            strength = (positiveCount / signals.length) * 100;
          } else if (negativeCount > positiveCount) {
            signal = -1;
            strength = (negativeCount / signals.length) * 100;
          } else {
            signal = 0;
            strength = 0;
          }
          break;
      }
      
      return {
        signal: signal > 0.1 ? 1 : (signal < -0.1 ? -1 : 0), // Threshold to avoid noise
        strength: Math.round(strength),
        details
      };
    } catch (error) {
      console.error('Error generating trading signal:', error);
      return {
        signal: 0,
        strength: 0,
        details: {}
      };
    }
  }
  
  /**
   * RSI (Relative Strength Index) Strategy
   */
  rsiStrategy(period = 14, overbought = 70, oversold = 30) {
    try {
      // Calculate RSI
      const prices = this.data.close;
      const gains = [];
      const losses = [];
      
      // Calculate price changes
      for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
      }
      
      // Calculate average gain and loss
      let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
      
      // Calculate RSI values
      const rsiValues = [];
      
      for (let i = period; i < prices.length; i++) {
        // Update average gain and loss using smoothed method
        avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;
        
        // Calculate RS and RSI
        const rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
        const rsi = 100 - (100 / (1 + rs));
        
        rsiValues.push(rsi);
      }
      
      // Get current RSI
      const currentRsi = rsiValues[rsiValues.length - 1];
      
      // Determine signal
      let signal = 0;
      
      if (currentRsi !== undefined) {
        if (currentRsi < oversold) {
          signal = 1; // Buy signal (oversold)
        } else if (currentRsi > overbought) {
          signal = -1; // Sell signal (overbought)
        }
      }
      
      return {
        signal,
        value: currentRsi,
        indicator: 'RSI'
      };
    } catch (error) {
      console.error('Error in RSI strategy:', error);
      return {
        signal: 0,
        value: null,
        indicator: 'RSI'
      };
    }
  }
  
  /**
   * MACD (Moving Average Convergence Divergence) Strategy
   */
  macdStrategy(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    try {
      const prices = this.data.close;
      
      // Calculate EMAs
      const fastEMA = this.calculateEMA(prices, fastPeriod);
      const slowEMA = this.calculateEMA(prices, slowPeriod);
      
      // Calculate MACD line
      const macdLine = [];
      for (let i = 0; i < fastEMA.length; i++) {
        if (i >= slowPeriod - fastPeriod) {
          macdLine.push(fastEMA[i] - slowEMA[i - (slowPeriod - fastPeriod)]);
        }
      }
      
      // Calculate signal line (EMA of MACD line)
      const signalLine = this.calculateEMA(macdLine, signalPeriod);
      
      // Calculate histogram
      const histogram = [];
      for (let i = 0; i < signalLine.length; i++) {
        histogram.push(macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i]);
      }
      
      // Get current values
      const currentMACD = macdLine[macdLine.length - 1];
      const currentSignal = signalLine[signalLine.length - 1];
      const currentHistogram = histogram[histogram.length - 1];
      const previousHistogram = histogram[histogram.length - 2];
      
      // Determine signal
      let signal = 0;
      
      if (currentMACD !== undefined && currentSignal !== undefined) {
        // MACD crosses above signal line
        if (currentMACD > currentSignal && macdLine[macdLine.length - 2] <= signalLine[signalLine.length - 2]) {
          signal = 1; // Buy signal
        }
        // MACD crosses below signal line
        else if (currentMACD < currentSignal && macdLine[macdLine.length - 2] >= signalLine[signalLine.length - 2]) {
          signal = -1; // Sell signal
        }
        // Histogram changes direction (weaker signal)
        else if (currentHistogram > 0 && previousHistogram < 0) {
          signal = 0.5; // Weaker buy signal
        }
        else if (currentHistogram < 0 && previousHistogram > 0) {
          signal = -0.5; // Weaker sell signal
        }
      }
      
      return {
        signal,
        value: `${currentMACD?.toFixed(5)} / ${currentSignal?.toFixed(5)}`,
        indicator: 'MACD'
      };
    } catch (error) {
      console.error('Error in MACD strategy:', error);
      return {
        signal: 0,
        value: null,
        indicator: 'MACD'
      };
    }
  }
  
  /**
   * Moving Average Crossover Strategy
   */
  movingAverageCrossover(shortPeriod = 10, longPeriod = 50) {
    try {
      const prices = this.data.close;
      
      // Calculate SMAs
      const shortSMA = this.calculateSMA(prices, shortPeriod);
      const longSMA = this.calculateSMA(prices, longPeriod);
      
      // Get current values
      const currentShortSMA = shortSMA[shortSMA.length - 1];
      const currentLongSMA = longSMA[longSMA.length - 1];
      const previousShortSMA = shortSMA[shortSMA.length - 2];
      const previousLongSMA = longSMA[longSMA.length - 2];
      
      // Determine signal
      let signal = 0;
      
      if (currentShortSMA !== undefined && currentLongSMA !== undefined) {
        // Golden cross (short MA crosses above long MA)
        if (currentShortSMA > currentLongSMA && previousShortSMA <= previousLongSMA) {
          signal = 1; // Buy signal
        }
        // Death cross (short MA crosses below long MA)
        else if (currentShortSMA < currentLongSMA && previousShortSMA >= previousLongSMA) {
          signal = -1; // Sell signal
        }
        // Already in a trend
        else if (currentShortSMA > currentLongSMA) {
          signal = 0.5; // Weak buy signal (already in uptrend)
        }
        else if (currentShortSMA < currentLongSMA) {
          signal = -0.5; // Weak sell signal (already in downtrend)
        }
      }
      
      return {
        signal,
        value: `${shortPeriod}SMA: ${currentShortSMA?.toFixed(5)} / ${longPeriod}SMA: ${currentLongSMA?.toFixed(5)}`,
        indicator: 'MA Cross'
      };
    } catch (error) {
      console.error('Error in Moving Average Crossover strategy:', error);
      return {
        signal: 0,
        value: null,
        indicator: 'MA Cross'
      };
    }
  }
  
  /**
   * Bollinger Bands Strategy
   */
  bollingerBandsStrategy(period = 20, stdDev = 2) {
    try {
      const prices = this.data.close;
      
      // Calculate SMA
      const sma = this.calculateSMA(prices, period);
      
      // Calculate standard deviation
      const stdDevs = [];
      for (let i = period - 1; i < prices.length; i++) {
        const periodPrices = prices.slice(i - (period - 1), i + 1);
        const mean = sma[i - (period - 1)];
        const squaredDiffs = periodPrices.map(price => Math.pow(price - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
        stdDevs.push(Math.sqrt(variance));
      }
      
      // Calculate bands
      const upperBands = [];
      const lowerBands = [];
      for (let i = 0; i < sma.length; i++) {
        upperBands.push(sma[i] + (stdDev * stdDevs[i]));
        lowerBands.push(sma[i] - (stdDev * stdDevs[i]));
      }
      
      // Get current values
      const currentPrice = prices[prices.length - 1];
      const currentUpper = upperBands[upperBands.length - 1];
      const currentLower = lowerBands[lowerBands.length - 1];
      const currentSMA = sma[sma.length - 1];
      
      // Determine signal
      let signal = 0;
      
      if (currentPrice !== undefined && currentUpper !== undefined && currentLower !== undefined) {
        // Price touches or crosses lower band (potential buy)
        if (currentPrice <= currentLower) {
          signal = 1; // Buy signal
        }
        // Price touches or crosses upper band (potential sell)
        else if (currentPrice >= currentUpper) {
          signal = -1; // Sell signal
        }
        // Price moves from lower to middle band (weaker buy)
        else if (currentPrice < currentSMA && prices[prices.length - 2] <= lowerBands[lowerBands.length - 2]) {
          signal = 0.5; // Weaker buy signal
        }
        // Price moves from upper to middle band (weaker sell)
        else if (currentPrice > currentSMA && prices[prices.length - 2] >= upperBands[upperBands.length - 2]) {
          signal = -0.5; // Weaker sell signal
        }
      }
      
      return {
        signal,
        value: `Upper: ${currentUpper?.toFixed(5)} / Lower: ${currentLower?.toFixed(5)}`,
        indicator: 'Bollinger Bands'
      };
    } catch (error) {
      console.error('Error in Bollinger Bands strategy:', error);
      return {
        signal: 0,
        value: null,
        indicator: 'Bollinger Bands'
      };
    }
  }
  
  /**
   * Calculate Simple Moving Average (SMA)
   */
  calculateSMA(data, period) {
    const sma = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - (period - 1), i + 1).reduce((total, value) => total + value, 0);
      sma.push(sum / period);
    }
    
    return sma;
  }
  
  /**
   * Calculate Exponential Moving Average (EMA)
   */
  calculateEMA(data, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Initialize EMA with SMA
    const smaInitial = data.slice(0, period).reduce((total, value) => total + value, 0) / period;
    ema.push(smaInitial);
    
    // Calculate EMA
    for (let i = period; i < data.length; i++) {
      ema.push((data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
    
    return ema;
  }
}

// Make available to background script
if (typeof module !== 'undefined') {
  module.exports = ForexTradingAnalysis;
}
