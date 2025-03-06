/**
 * GBP/USD Forex Trader - Popup UI Script
 * 
 * Handles the user interface for the Chrome extension popup
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const currentRateElement = document.getElementById('currentRate');
  const rateChangeElement = document.getElementById('rateChange');
  const signalBoxElement = document.getElementById('signalBox');
  const signalIconElement = document.getElementById('signalIcon');
  const signalTextElement = document.getElementById('signalText');
  const signalTimeElement = document.getElementById('signalTime');
  const strengthFillElement = document.getElementById('strengthFill');
  const strengthValueElement = document.getElementById('strengthValue');

  // Indicator Elements
  const rsiValueElement = document.getElementById('rsiValue');
  const rsiSignalElement = document.getElementById('rsiSignal');
  const macdValueElement = document.getElementById('macdValue');
  const macdSignalElement = document.getElementById('macdSignal');
  const maCrossValueElement = document.getElementById('maCrossValue');
  const maCrossSignalElement = document.getElementById('maCrossSignal');
  const bbValueElement = document.getElementById('bbValue');
  const bbSignalElement = document.getElementById('bbSignal');

  // Settings Elements
  const updateIntervalElement = document.getElementById('updateInterval');
  const notificationsEnabledElement = document.getElementById('notificationsEnabled');
  const signalThresholdElement = document.getElementById('signalThreshold');
  const modelSelectionElement = document.getElementById('modelSelection');

  // Action Buttons
  const refreshButtonElement = document.getElementById('refreshButton');
  const resetButtonElement = document.getElementById('resetButton');

  // State
  let lastSignal = null;
  let settings = null;
  let previousRate = null;

  // Initialize the popup
  initializePopup();

  // Initialize the popup
  function initializePopup() {
    console.log('Initializing popup UI...');
    
    // Get current state from background script
    try {
      chrome.runtime.sendMessage({ type: 'getState' }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error getting state:', chrome.runtime.lastError);
          showError('Background service not ready. Please try again in a moment.');
          return;
        }
        
        if (response) {
          settings = response.settings;
          lastSignal = response.lastSignal;
          
          // Update the UI
          updateSettingsUI();
          updateSignalUI();
        } else {
          showError('Failed to get extension state');
        }
      });
    } catch (error) {
      console.error('Exception when getting state:', error);
      showError('Error connecting to background service');
    }
    
    // Set up event listeners for settings changes
    updateIntervalElement.addEventListener('change', updateSetting);
    notificationsEnabledElement.addEventListener('change', updateSetting);
    signalThresholdElement.addEventListener('change', updateSetting);
    modelSelectionElement.addEventListener('change', updateSetting);
    
    // Set up action buttons
    refreshButtonElement.addEventListener('click', refreshData);
    resetButtonElement.addEventListener('click', resetExtension);
  }

  // Update the settings UI
  function updateSettingsUI() {
    if (!settings) return;
    
    updateIntervalElement.value = settings.updateInterval;
    notificationsEnabledElement.checked = settings.notificationsEnabled;
    signalThresholdElement.value = settings.signalThreshold;
    modelSelectionElement.value = settings.modelSelection;
  }

  // Update a setting
  function updateSetting(event) {
    const element = event.target;
    let value;
    
    switch (element.id) {
      case 'updateInterval':
        value = parseInt(element.value);
        break;
      case 'notificationsEnabled':
        value = element.checked;
        break;
      case 'signalThreshold':
        value = parseInt(element.value);
        break;
      case 'modelSelection':
        value = element.value;
        break;
    }
    
    // Send updated setting to background script
    try {
      chrome.runtime.sendMessage({
        type: 'updateSettings',
        data: { [element.id]: value }
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error updating setting:', chrome.runtime.lastError);
          return;
        }
        console.log('Setting updated:', element.id, value);
      });
    } catch (error) {
      console.error('Exception when updating setting:', error);
    }
  }

  // Update the signal UI
  function updateSignalUI() {
    if (!lastSignal) return;
    
    // Update current rate
    if (lastSignal.rate) {
      currentRateElement.textContent = lastSignal.rate.toFixed(5);
      
      // Update rate change if we have a previous rate
      if (previousRate) {
        const change = ((lastSignal.rate / previousRate) - 1) * 100;
        const changeText = change.toFixed(3) + '%';
        rateChangeElement.textContent = change >= 0 ? `+${changeText}` : changeText;
        rateChangeElement.className = 'change ' + (change >= 0 ? 'positive' : 'negative');
      }
      
      previousRate = lastSignal.rate;
    }
    
    // Update signal box
    const signalValue = lastSignal.signal;
    let signalClass, signalIcon, signalText;
    
    if (signalValue > 0) {
      signalClass = 'buy';
      signalIcon = '🔼';
      signalText = 'BUY SIGNAL';
    } else if (signalValue < 0) {
      signalClass = 'sell';
      signalIcon = '🔽';
      signalText = 'SELL SIGNAL';
    } else {
      signalClass = 'neutral';
      signalIcon = '⚖️';
      signalText = 'NEUTRAL';
    }
    
    signalBoxElement.className = `signal-box ${signalClass}`;
    signalIconElement.textContent = signalIcon;
    signalTextElement.textContent = signalText;
    
    // Update signal time
    if (lastSignal.timestamp) {
      const signalTime = new Date(lastSignal.timestamp);
      signalTimeElement.textContent = signalTime.toLocaleString();
    }
    
    // Update signal strength
    const strength = lastSignal.strength || 0;
    strengthFillElement.style.width = `${strength}%`;
    strengthValueElement.textContent = `${strength}%`;
    
    // Set strength fill color
    if (strength >= 70) {
      strengthFillElement.className = 'strength-fill strong';
    } else if (strength >= 40) {
      strengthFillElement.className = 'strength-fill medium';
    } else {
      strengthFillElement.className = 'strength-fill weak';
    }
    
    // Update individual indicators
    updateIndicatorsUI(lastSignal.details);
  }

  // Update the indicators UI
  function updateIndicatorsUI(details) {
    if (!details) return;
    
    // Update RSI indicator
    if (details.rsi) {
      rsiValueElement.textContent = details.rsi.value ? details.rsi.value.toFixed(2) : '-';
      updateIndicatorSignal(rsiSignalElement, details.rsi.signal);
    }
    
    // Update MACD indicator
    if (details.macd) {
      macdValueElement.textContent = details.macd.value || '-';
      updateIndicatorSignal(macdSignalElement, details.macd.signal);
    }
    
    // Update MA Cross indicator
    if (details.maCross) {
      maCrossValueElement.textContent = details.maCross.value || '-';
      updateIndicatorSignal(maCrossSignalElement, details.maCross.signal);
    }
    
    // Update Bollinger Bands indicator
    if (details.bollinger) {
      bbValueElement.textContent = details.bollinger.value || '-';
      updateIndicatorSignal(bbSignalElement, details.bollinger.signal);
    }
  }

  // Update an indicator signal element
  function updateIndicatorSignal(element, signal) {
    if (signal > 0) {
      element.textContent = 'BUY';
      element.className = 'indicator-signal buy';
    } else if (signal < 0) {
      element.textContent = 'SELL';
      element.className = 'indicator-signal sell';
    } else {
      element.textContent = 'NEUTRAL';
      element.className = 'indicator-signal neutral';
    }
  }

  // Refresh data
  function refreshData() {
    refreshButtonElement.textContent = 'Refreshing...';
    refreshButtonElement.disabled = true;
    
    try {
      chrome.runtime.sendMessage({ type: 'refreshData' }, response => {
        refreshButtonElement.textContent = 'Refresh';
        refreshButtonElement.disabled = false;
        
        if (chrome.runtime.lastError) {
          console.error('Error refreshing data:', chrome.runtime.lastError);
          showError('Failed to refresh data. Try again in a moment.');
          return;
        }
        
        if (response && response.success) {
          console.log('Data refreshed successfully');
          // Data will be updated via message listener
        } else {
          showError('Failed to refresh data');
        }
      });
    } catch (error) {
      console.error('Exception when refreshing data:', error);
      refreshButtonElement.textContent = 'Refresh';
      refreshButtonElement.disabled = false;
      showError('Error connecting to background service');
    }
  }

  // Reset extension
  function resetExtension() {
    if (confirm('Are you sure you want to reset the extension to default settings?')) {
      resetButtonElement.textContent = 'Resetting...';
      resetButtonElement.disabled = true;
      
      try {
        chrome.runtime.sendMessage({ type: 'resetExtension' }, response => {
          resetButtonElement.textContent = 'Reset';
          resetButtonElement.disabled = false;
          
          if (chrome.runtime.lastError) {
            console.error('Error resetting extension:', chrome.runtime.lastError);
            showError('Failed to reset extension. Try again in a moment.');
            return;
          }
          
          if (response && response.success) {
            console.log('Extension reset successfully');
            // Extension will be reset via message listener
          } else {
            showError('Failed to reset extension');
          }
        });
      } catch (error) {
        console.error('Exception when resetting extension:', error);
        resetButtonElement.textContent = 'Reset';
        resetButtonElement.disabled = false;
        showError('Error connecting to background service');
      }
    }
  }

  // Show an error message
  function showError(message) {
    console.error(message);
    signalTextElement.textContent = message;
    signalBoxElement.className = 'signal-box error';
    signalIconElement.textContent = '⚠️';
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener(message => {
    console.log('Received message from background:', message.type);
    
    if (message.type === 'signalUpdate') {
      lastSignal = message.data;
      updateSignalUI();
    } else if (message.type === 'resetComplete') {
      settings = message.data.settings;
      lastSignal = message.data.lastSignal;
      updateSettingsUI();
      updateSignalUI();
    }
  });
});
