# CediPay Checkout Widget - Merchant Setup Guide

## Overview

The CediPay Checkout Widget is a secure, easy-to-integrate JavaScript widget that allows merchants to accept mobile money payments on their websites. The widget handles all payment processing, security, and user interface components.

## Features

- ✅ **MTN MoMo Integration** - Support for MTN Mobile Money payments
- ✅ **Multiple Networks** - MTN, Vodafone Cash, AirtelTigo Money
- ✅ **Real-time Status Updates** - Live payment status tracking
- ✅ **Secure** - No sensitive data stored in the browser
- ✅ **Mobile Responsive** - Works seamlessly on all devices
- ✅ **Easy Integration** - Just a few lines of code
- ✅ **Customizable** - Configure to match your brand

## Quick Start

### Step 1: Get Your Merchant ID

1. Register for a CediPay merchant account at [https://cedipay.com/register](https://cedipay.com/register)
2. Complete the verification process
3. Your unique Merchant ID will be displayed in your dashboard

### Step 2: Include the Widget

Add the CediPay widget script to your HTML page:

```html
<script src="https://api.cedipay.com/cedipay-checkout.js"></script>
```

### Step 3: Initialize the Widget

Initialize the widget with your merchant ID:

```html
<script>
  CediPay.init({
    merchantId: 'your-merchant-id-here',
    apiUrl: 'https://api.cedipay.com/api'
  });
</script>
```

### Step 4: Trigger Payment

Call the `openCheckout()` method when you want to accept a payment:

```html
<button onclick="startPayment()">Pay Now</button>

<script>
  function startPayment() {
    CediPay.openCheckout({
      amount: 50.00,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      description: 'Product Purchase',
      onSuccess: function(data) {
        console.log('Payment successful!', data);
        // Redirect to success page or show confirmation
        window.location.href = '/thank-you?ref=' + data.transactionId;
      },
      onError: function(error) {
        console.error('Payment failed:', error);
        alert('Payment failed. Please try again.');
      },
      onClose: function() {
        console.log('Modal closed');
      }
    });
  }
</script>
```

## API Reference

### CediPay.init(options)

Initialize the CediPay widget with your configuration.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your unique merchant ID from CediPay |
| `apiUrl` | string | No | API endpoint (default: production URL) |
| `theme` | object | No | Custom theme configuration |

**Example:**

```javascript
CediPay.init({
  merchantId: 'mer_123456789',
  apiUrl: 'https://api.cedipay.com/api',
  theme: {
    primaryColor: '#10b981',
    errorColor: '#ef4444',
    fontFamily: 'system-ui'
  }
});
```

### CediPay.openCheckout(options)

Open the payment modal to collect payment information.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Payment amount in GHS (minimum 1.00) |
| `customerName` | string | No | Customer's full name (pre-filled if provided) |
| `customerEmail` | string | No | Customer's email address |
| `description` | string | No | Payment description/purpose |
| `onSuccess` | function | No | Callback when payment succeeds |
| `onError` | function | No | Callback when payment fails |
| `onClose` | function | No | Callback when modal is closed |

**Success Callback Data:**

```javascript
{
  transactionId: 'txn_abc123',
  status: 'COMPLETED',
  amount: '50.00',
  network: 'MTN',
  reference: 'MOMO-REF-123',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T10:31:00Z'
}
```

**Error Callback Data:**

```javascript
{
  message: 'Payment failed',
  code: 'PAYMENT_FAILED'
}
```

### CediPay.closeCheckout()

Programmatically close the payment modal.

```javascript
CediPay.closeCheckout();
```

## Integration Examples

### E-commerce Product Page

```html
<!DOCTYPE html>
<html>
<head>
  <title>Product Page</title>
  <script src="https://api.cedipay.com/cedipay-checkout.js"></script>
</head>
<body>
  <div class="product">
    <h1>Premium Headphones</h1>
    <p class="price">GHS 150.00</p>
    <button id="buy-btn">Buy Now</button>
  </div>

  <script>
    CediPay.init({
      merchantId: 'your-merchant-id'
    });

    document.getElementById('buy-btn').addEventListener('click', function() {
      CediPay.openCheckout({
        amount: 150.00,
        description: 'Premium Headphones',
        onSuccess: function(data) {
          // Send transaction ID to your server to verify
          fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: data.transactionId })
          })
          .then(response => response.json())
          .then(result => {
            if (result.verified) {
              window.location.href = '/success';
            }
          });
        },
        onError: function(error) {
          alert('Payment failed: ' + error.message);
        }
      });
    });
  </script>
</body>
</html>
```

### Service Subscription

```javascript
function subscribeMonthly() {
  CediPay.openCheckout({
    amount: 29.99,
    description: 'Monthly Subscription - Premium Plan',
    customerEmail: userEmail, // From your app state
    customerName: userName,
    onSuccess: function(data) {
      // Activate subscription in your backend
      activateSubscription(data.transactionId);
    },
    onError: function(error) {
      showErrorNotification('Subscription payment failed');
    }
  });
}
```

### Donation/Contribution

```javascript
function donate(amount) {
  CediPay.openCheckout({
    amount: amount,
    description: 'Donation to Our Cause',
    onSuccess: function(data) {
      showThankYouMessage(data);
      sendDonationReceipt(data.transactionId);
    }
  });
}
```

## Security Best Practices

### 1. Verify Payments Server-Side

Always verify payment status on your server before fulfilling orders:

```javascript
// Client-side (after onSuccess callback)
fetch('/api/verify-payment', {
  method: 'POST',
  body: JSON.stringify({ transactionId: data.transactionId }),
  headers: { 'Content-Type': 'application/json' }
});

// Server-side (Node.js example)
app.post('/api/verify-payment', async (req, res) => {
  const { transactionId } = req.body;
  
  // Call CediPay API to verify
  const response = await fetch(
    `https://api.cedipay.com/api/payments/status/${transactionId}`,
    {
      headers: {
        'Authorization': `Bearer ${YOUR_SECRET_KEY}`
      }
    }
  );
  
  const data = await response.json();
  
  if (data.success && data.data.status === 'COMPLETED') {
    // Payment verified - fulfill order
    res.json({ verified: true });
  } else {
    res.json({ verified: false });
  }
});
```

### 2. Use HTTPS

Always serve your website over HTTPS to protect customer data in transit.

### 3. Don't Store Sensitive Data

Never store mobile money numbers or other sensitive payment information in your frontend code or databases unless you are PCI compliant.

### 4. Implement Webhooks

Set up webhooks to receive real-time payment notifications:

```javascript
// Register webhook endpoint in your CediPay dashboard
// Your endpoint should verify the webhook signature
app.post('/webhooks/cedipay', (req, res) => {
  const signature = req.headers['x-cedipay-signature'];
  
  // Verify signature
  if (verifyWebhookSignature(req.body, signature)) {
    const { event, data } = req.body;
    
    if (event === 'payment.completed') {
      // Update order status in your database
      updateOrderStatus(data.transactionId, 'paid');
    }
    
    res.status(200).send('OK');
  } else {
    res.status(401).send('Invalid signature');
  }
});
```

## Testing

### Test Mode

For development and testing, use these test credentials:

- **Test Merchant ID:** `demo-merchant-001`
- **Test Mobile Number:** Any valid 10-digit number (0XXXXXXXXX)
- **Test Networks:** All networks available in test mode

Test payments will not actually deduct money but will go through the full payment flow.

### Demo Page

Visit our demo page to see the widget in action:

```
https://api.cedipay.com/demo.html
```

## Supported Networks

- **MTN Mobile Money** - All MTN subscribers in Ghana
- **Vodafone Cash** - All Vodafone subscribers in Ghana
- **AirtelTigo Money** - All AirtelTigo subscribers in Ghana

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile, etc.)

## Troubleshooting

### Widget Not Loading

1. Check that the script URL is correct
2. Ensure you're loading the script before calling `CediPay.init()`
3. Check browser console for errors

### Payment Fails Immediately

1. Verify your merchant ID is correct
2. Check that the amount is at least 1.00 GHS
3. Ensure mobile number format is correct (10 digits starting with 0)

### Modal Not Appearing

1. Check for CSS conflicts with your site
2. Ensure no other modals or overlays are blocking it
3. Check z-index of your elements (widget uses z-index: 999999)

## Support

For technical support:

- **Email:** support@cedipay.com
- **Documentation:** https://docs.cedipay.com
- **Developer Portal:** https://developers.cedipay.com

## Changelog

### Version 1.0.0 (Current)

- Initial release
- MTN MoMo support
- Multi-network support (MTN, Vodafone, AirtelTigo)
- Real-time payment status polling
- Mobile-responsive design
- Comprehensive error handling

## License

The CediPay Checkout Widget is proprietary software. See the [Terms of Service](https://cedipay.com/terms) for usage terms.
