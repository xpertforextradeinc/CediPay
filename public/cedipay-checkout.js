/**
 * CediPay Checkout Widget
 * A secure, embeddable payment widget for merchant websites
 * 
 * Usage:
 * <script src="https://your-domain.com/cedipay-checkout.js"></script>
 * <script>
 *   CediPay.init({
 *     merchantId: 'your-merchant-id',
 *     apiUrl: 'https://your-api-domain.com/api'
 *   });
 * </script>
 */

(function (window) {
  'use strict';

  // Default configuration
  const defaultConfig = {
    apiUrl: 'http://localhost:4000/api',
    merchantId: null,
    theme: {
      primaryColor: '#10b981',
      errorColor: '#ef4444',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }
  };

  let config = { ...defaultConfig };
  let activeModal = null;

  /**
   * Initialize CediPay widget
   */
  function init(options) {
    config = { ...defaultConfig, ...options };
    
    if (!config.merchantId) {
      console.error('CediPay: merchantId is required');
      return;
    }

    // Inject CSS if not already present
    if (!document.getElementById('cedipay-styles')) {
      injectStyles();
    }
  }

  /**
   * Open checkout modal
   */
  function openCheckout(options) {
    const checkoutOptions = {
      amount: options.amount || 0,
      customerName: options.customerName || '',
      customerEmail: options.customerEmail || '',
      description: options.description || '',
      onSuccess: options.onSuccess || function() {},
      onError: options.onError || function() {},
      onClose: options.onClose || function() {}
    };

    if (!config.merchantId) {
      console.error('CediPay: Please call CediPay.init() first');
      return;
    }

    if (!checkoutOptions.amount || checkoutOptions.amount < 1) {
      console.error('CediPay: Valid amount is required');
      return;
    }

    createCheckoutModal(checkoutOptions);
  }

  /**
   * Create and display checkout modal
   */
  function createCheckoutModal(options) {
    // Remove any existing modal
    if (activeModal) {
      document.body.removeChild(activeModal);
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'cedipay-overlay';
    overlay.onclick = function(e) {
      if (e.target === overlay) {
        closeModal(options.onClose);
      }
    };

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'cedipay-modal';
    modal.innerHTML = `
      <div class="cedipay-header">
        <h2 class="cedipay-title">Complete Payment</h2>
        <button class="cedipay-close" onclick="CediPay.closeCheckout()">&times;</button>
      </div>
      <div class="cedipay-body">
        <div class="cedipay-amount-display">
          <span class="cedipay-amount-label">Amount to Pay</span>
          <span class="cedipay-amount-value">GHS ${options.amount.toFixed(2)}</span>
        </div>
        
        <form id="cedipay-form" class="cedipay-form">
          <div class="cedipay-form-group">
            <label for="cedipay-name">Full Name</label>
            <input 
              type="text" 
              id="cedipay-name" 
              name="customerName" 
              value="${escapeHtml(options.customerName)}"
              placeholder="John Doe"
              required
            />
          </div>

          <div class="cedipay-form-group">
            <label for="cedipay-email">Email (Optional)</label>
            <input 
              type="email" 
              id="cedipay-email" 
              name="customerEmail" 
              value="${escapeHtml(options.customerEmail)}"
              placeholder="john@example.com"
            />
          </div>

          <div class="cedipay-form-group">
            <label for="cedipay-mobile">Mobile Number</label>
            <input 
              type="tel" 
              id="cedipay-mobile" 
              name="mobileNumber" 
              placeholder="0541234567"
              pattern="0[0-9]{9}"
              required
            />
            <small class="cedipay-hint">Format: 0541234567 (10 digits)</small>
          </div>

          <div class="cedipay-form-group">
            <label for="cedipay-network">Network Provider</label>
            <select id="cedipay-network" name="network" required>
              <option value="">Select network</option>
              <option value="MTN">MTN Mobile Money</option>
              <option value="VODAFONE">Vodafone Cash</option>
              <option value="AIRTELTIGO">AirtelTigo Money</option>
            </select>
          </div>

          <div id="cedipay-error" class="cedipay-error" style="display: none;"></div>
          <div id="cedipay-success" class="cedipay-success" style="display: none;"></div>

          <button type="submit" class="cedipay-btn cedipay-btn-primary" id="cedipay-submit">
            Pay GHS ${options.amount.toFixed(2)}
          </button>
        </form>

        <div id="cedipay-processing" class="cedipay-processing" style="display: none;">
          <div class="cedipay-spinner"></div>
          <p>Processing your payment...</p>
          <p class="cedipay-processing-info">Please approve the transaction on your phone</p>
        </div>
      </div>
      <div class="cedipay-footer">
        <span class="cedipay-secure">🔒 Secured by CediPay</span>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeModal = overlay;

    // Setup form submission
    setupFormHandler(options);
  }

  /**
   * Setup form submission handler
   */
  function setupFormHandler(options) {
    const form = document.getElementById('cedipay-form');
    const submitBtn = document.getElementById('cedipay-submit');
    const processingDiv = document.getElementById('cedipay-processing');
    
    form.onsubmit = async function(e) {
      e.preventDefault();
      
      // Clear previous messages
      hideMessage('error');
      hideMessage('success');

      const formData = new FormData(form);
      const paymentData = {
        merchantId: config.merchantId,
        amount: options.amount,
        customerName: formData.get('customerName'),
        customerEmail: formData.get('customerEmail'),
        mobileNumber: formData.get('mobileNumber'),
        network: formData.get('network'),
        description: options.description
      };

      // Disable form and show processing
      submitBtn.disabled = true;
      form.style.display = 'none';
      processingDiv.style.display = 'block';

      try {
        const response = await fetch(`${config.apiUrl}/payments/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Poll for payment status
          pollPaymentStatus(result.data.transactionId, options);
        } else {
          throw new Error(result.error || 'Payment initiation failed');
        }
      } catch (error) {
        console.error('Payment error:', error);
        processingDiv.style.display = 'none';
        form.style.display = 'block';
        submitBtn.disabled = false;
        showMessage('error', error.message || 'Failed to process payment. Please try again.');
        options.onError(error);
      }
    };
  }

  /**
   * Poll payment status
   */
  function pollPaymentStatus(transactionId, options, attempts = 0) {
    const maxAttempts = 60; // Poll for up to 2 minutes (60 * 2 seconds)
    
    if (attempts >= maxAttempts) {
      showMessage('error', 'Payment verification timeout. Please contact support.');
      resetForm();
      options.onError(new Error('Payment verification timeout'));
      return;
    }

    setTimeout(async () => {
      try {
        const response = await fetch(`${config.apiUrl}/payments/status/${transactionId}`);
        const result = await response.json();

        if (result.success) {
          const status = result.data.status;
          
          if (status === 'COMPLETED') {
            showPaymentSuccess(result.data, options);
            options.onSuccess(result.data);
          } else if (status === 'FAILED') {
            resetForm();
            showMessage('error', 'Payment failed. Please try again.');
            options.onError(new Error('Payment failed'));
          } else {
            // Continue polling
            pollPaymentStatus(transactionId, options, attempts + 1);
          }
        } else {
          resetForm();
          showMessage('error', 'Failed to verify payment status');
          options.onError(new Error('Status check failed'));
        }
      } catch (error) {
        console.error('Status check error:', error);
        // Continue polling on error
        pollPaymentStatus(transactionId, options, attempts + 1);
      }
    }, 2000); // Poll every 2 seconds
  }

  /**
   * Show payment success
   */
  function showPaymentSuccess(data, options) {
    const processingDiv = document.getElementById('cedipay-processing');
    processingDiv.innerHTML = `
      <div class="cedipay-success-icon">✓</div>
      <h3>Payment Successful!</h3>
      <p>Amount: GHS ${parseFloat(data.amount).toFixed(2)}</p>
      <p class="cedipay-tx-ref">Transaction ID: ${data.transactionId}</p>
      <button class="cedipay-btn cedipay-btn-primary" onclick="CediPay.closeCheckout()">
        Done
      </button>
    `;
  }

  /**
   * Reset form to initial state
   */
  function resetForm() {
    const form = document.getElementById('cedipay-form');
    const submitBtn = document.getElementById('cedipay-submit');
    const processingDiv = document.getElementById('cedipay-processing');
    
    if (form && submitBtn && processingDiv) {
      form.style.display = 'block';
      processingDiv.style.display = 'none';
      submitBtn.disabled = false;
    }
  }

  /**
   * Show error or success message
   */
  function showMessage(type, message) {
    const messageDiv = document.getElementById(`cedipay-${type}`);
    if (messageDiv) {
      messageDiv.textContent = message;
      messageDiv.style.display = 'block';
    }
  }

  /**
   * Hide error or success message
   */
  function hideMessage(type) {
    const messageDiv = document.getElementById(`cedipay-${type}`);
    if (messageDiv) {
      messageDiv.style.display = 'none';
    }
  }

  /**
   * Close checkout modal
   */
  function closeCheckout() {
    if (activeModal && activeModal.parentNode) {
      document.body.removeChild(activeModal);
      activeModal = null;
    }
  }

  /**
   * Close modal with callback
   */
  function closeModal(onClose) {
    closeCheckout();
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    const link = document.createElement('link');
    link.id = 'cedipay-styles';
    link.rel = 'stylesheet';
    link.href = config.apiUrl.replace('/api', '') + '/cedipay-checkout.css';
    document.head.appendChild(link);
  }

  // Expose public API
  window.CediPay = {
    init: init,
    openCheckout: openCheckout,
    closeCheckout: closeCheckout,
    version: '1.0.0'
  };

})(window);
