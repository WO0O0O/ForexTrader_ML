/**
 * GBP/USD Forex Trader - Background Script
 * 
 * Responsible for data fetching, signal checking, and notifications
 */

// Import analysis class
importScripts('./analysis.js');

// State
let tradingAnalysis = null;
let settings = {
  updateInterval: 5,          // Minutes
  notificationsEnabled: true,
  signalThreshold: 70,        // Percentage
  modelSelection: 'ensemble'  // ensemble, ml, technical
};
let lastSignal = null;
let updateTimer = null;

// Debugging flag - set to true to enable detailed logging
const DEBUG = true;

// Initialize when the extension is loaded
init();

// Handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (DEBUG) console.log('Received message:', message.type);
  
  try {
    // Ensure all message handlers provide a response
    switch (message.type) {
      case 'getState':
        handleGetState(sendResponse);
        break;
        
      case 'refreshData':
        handleRefreshData(sendResponse);
        break;
        
      case 'updateSettings':
        handleUpdateSettings(message.data, sendResponse);
        break;
        
      case 'resetExtension':
        handleResetExtension(sendResponse);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error processing message:', error.message);
    sendResponse({ success: false, error: error.message });
  }
  
  // Return true to indicate that the response will be sent asynchronously
  return true;
});

// Initialize the extension
async function init() {
  if (DEBUG) console.log('Initializing background script...');
  
  // Load saved settings
  await loadSettings();
  
  // Initialize trading analysis
  try {
    tradingAnalysis = new ForexTradingAnalysis();
    await tradingAnalysis.initialize();
    if (DEBUG) console.log('Trading analysis initialized successfully');
  } catch (error) {
    console.error('Failed to initialize trading analysis:', error.message);
  }
  
  // Start the update timer
  startUpdateTimer();
  
  // Force a data refresh on startup
  refreshData();
}

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (data) => {
      if (data.settings) {
        settings = { ...settings, ...data.settings };
        if (DEBUG) console.log('Loaded settings:', settings);
      } else {
        if (DEBUG) console.log('No saved settings found, using defaults');
      }
      resolve();
    });
  });
}

// Save settings to storage
async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ 'settings': settings }, () => {
      if (DEBUG) console.log('Settings saved');
      resolve();
    });
  });
}

// Start the update timer
function startUpdateTimer() {
  if (updateTimer) {
    clearInterval(updateTimer);
  }
  
  const updateIntervalMs = settings.updateInterval * 60 * 1000;
  updateTimer = setInterval(() => {
    refreshData();
  }, updateIntervalMs);
  
  if (DEBUG) console.log(`Update timer started: ${settings.updateInterval} minutes`);
}

// Refresh data
async function refreshData() {
  if (DEBUG) console.log('Refreshing data...');
  
  if (!tradingAnalysis) {
    if (DEBUG) console.log('Trading analysis not initialized, reinitializing...');
    try {
      tradingAnalysis = new ForexTradingAnalysis();
      await tradingAnalysis.initialize();
    } catch (error) {
      console.error('Failed to initialize trading analysis:', error.message);
      return { success: false, error: 'Failed to initialize trading analysis' };
    }
  }
  
  try {
    // Get current rate
    const currentRate = await tradingAnalysis.getCurrentRate();
    if (DEBUG) console.log('Current rate:', currentRate);
    
    // Get trading signal
    const strategy = settings.modelSelection;
    const signal = await tradingAnalysis.getSignal(strategy);
    if (DEBUG) console.log('Signal:', signal);
    
    // Update last signal
    const prevSignal = lastSignal ? lastSignal.signal : null;
    lastSignal = {
      timestamp: new Date().getTime(),
      rate: currentRate,
      signal: signal.signal,
      strength: signal.strength,
      details: signal.details
    };
    
    // Send signal update to any open popups
    sendMessageToPopups('signalUpdate', lastSignal)
      .catch(() => {
        if (DEBUG) console.log('No open popups to receive signal update');
      });
    
    // Check if we should send a notification
    if (settings.notificationsEnabled && 
        signal.strength >= settings.signalThreshold && 
        signal.signal !== 0 &&
        signal.signal !== prevSignal) {
      showNotification(signal);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error refreshing data:', error.message);
    return { success: false, error: error.message };
  }
}

// Show a notification
function showNotification(signal) {
  const signalType = signal.signal > 0 ? 'BUY' : 'SELL';
  const signalEmoji = signal.signal > 0 ? '🔼' : '🔽';
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../images/icon128.png',
    title: `GBP/USD ${signalType} Signal`,
    message: `${signalEmoji} ${signalType} signal detected with ${signal.strength}% strength!`,
    priority: 2
  });
  
  if (DEBUG) console.log(`Notification sent: ${signalType} signal`);
}

// Send a message to all open popups
async function sendMessageToPopups(type, data) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type, data }, () => {
        if (chrome.runtime.lastError) {
          // This error is expected if no popups are open
          if (DEBUG && !chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            console.error('Error sending message to popups:', chrome.runtime.lastError.message);
          }
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (error) {
      // Handle any other errors that might occur
      if (DEBUG && !error.message.includes('Receiving end does not exist')) {
        console.error('Exception when sending message to popups:', error.message);
      }
      reject(error);
    }
  });
}

// HANDLER FUNCTIONS FOR MESSAGES

// Handle getState message
function handleGetState(sendResponse) {
  sendResponse({
    settings: settings,
    lastSignal: lastSignal
  });
}

// Handle refreshData message
async function handleRefreshData(sendResponse) {
  const result = await refreshData();
  sendResponse(result);
}

// Handle updateSettings message
async function handleUpdateSettings(data, sendResponse) {
  if (DEBUG) console.log('Updating settings:', data);
  
  // Update settings
  settings = { ...settings, ...data };
  
  // If update interval changed, restart the timer
  if (data.updateInterval) {
    startUpdateTimer();
  }
  
  // Save settings
  await saveSettings();
  
  sendResponse({ success: true });
}

// Handle resetExtension message
async function handleResetExtension(sendResponse) {
  if (DEBUG) console.log('Resetting extension...');
  
  // Reset settings to defaults
  settings = {
    updateInterval: 5,
    notificationsEnabled: true,
    signalThreshold: 70,
    modelSelection: 'ensemble'
  };
  
  // Save settings
  await saveSettings();
  
  // Reinitialize
  if (tradingAnalysis) {
    tradingAnalysis = null;
  }
  
  try {
    tradingAnalysis = new ForexTradingAnalysis();
    await tradingAnalysis.initialize();
  } catch (error) {
    console.error('Failed to reinitialize trading analysis:', error.message);
    sendResponse({ success: false, error: 'Failed to reinitialize trading analysis' });
    return;
  }
  
  // Restart update timer
  startUpdateTimer();
  
  // Force a data refresh
  await refreshData();
  
  // Send reset complete message to popups
  try {
    await sendMessageToPopups('resetComplete', {
      settings: settings,
      lastSignal: lastSignal
    });
  } catch (error) {
    // Ignore errors if no popups are open
  }
  
  sendResponse({ success: true });
}
