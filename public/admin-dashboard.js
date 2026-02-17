/**
 * CediPay Admin Dashboard
 * Secure admin panel for merchant and transaction management
 */

(function() {
  'use strict';

  // Configuration
  const API_URL = window.location.origin + '/api';
  let authToken = localStorage.getItem('cedipay_admin_token');
  let currentUser = null;
  let currentView = 'dashboard';

  // Utility: HTML escape to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Utility: Format date
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  // Utility: Format currency
  function formatCurrency(amount) {
    return `GHS ${parseFloat(amount).toFixed(2)}`;
  }

  // Show/hide loading overlay
  function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
  }

  function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }

  // API Helper
  async function apiCall(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Login
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
      showLoading();
      errorEl.style.display = 'none';

      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      authToken = data.token;
      localStorage.setItem('cedipay_admin_token', authToken);

      // Verify admin role
      const profile = await apiCall('/auth/profile');
      
      if (profile.user.role !== 'ADMIN') {
        throw new Error('Admin access required');
      }

      currentUser = profile.user;
      showDashboard();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    } finally {
      hideLoading();
    }
  }

  // Logout
  function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('cedipay_admin_token');
    showLogin();
  }

  // Show login screen
  function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardScreen').style.display = 'none';
  }

  // Show dashboard
  function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'flex';
    document.getElementById('adminEmail').textContent = currentUser.email;
    loadView('dashboard');
  }

  // Load view
  function loadView(view) {
    currentView = view;
    
    // Update active menu item
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === view) {
        link.classList.add('active');
      }
    });

    // Load view content
    const viewContainer = document.getElementById('viewContainer');
    
    switch(view) {
      case 'dashboard':
        loadDashboardView(viewContainer);
        break;
      case 'merchants':
        loadMerchantsView(viewContainer);
        break;
      case 'transactions':
        loadTransactionsView(viewContainer);
        break;
      case 'kyc':
        loadKYCView(viewContainer);
        break;
      case 'payouts':
        loadPayoutsView(viewContainer);
        break;
      case 'audit':
        loadAuditLogsView(viewContainer);
        break;
      default:
        viewContainer.innerHTML = '<div class="card"><p>View not found</p></div>';
    }
  }

  // Dashboard View
  async function loadDashboardView(container) {
    try {
      showLoading();
      const data = await apiCall('/admin/metrics');
      
      container.innerHTML = `
        <div class="card-header">
          <h2>📊 Dashboard Overview</h2>
          <p>Platform metrics and statistics</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Total Merchants</div>
            <div class="metric-value">${data.metrics.totalMerchants}</div>
          </div>
          <div class="metric-card success">
            <div class="metric-label">Total Transactions</div>
            <div class="metric-value">${data.metrics.totalTransactions}</div>
          </div>
          <div class="metric-card warning">
            <div class="metric-label">Pending KYC</div>
            <div class="metric-value">${data.metrics.pendingKYC}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Recent (24h)</div>
            <div class="metric-value">${data.metrics.recentTransactions}</div>
          </div>
        </div>

        <div class="card">
          <h3>Transaction Statistics</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.transactionStats.map(stat => `
                  <tr>
                    <td><span class="badge badge-${stat.status.toLowerCase()}">${escapeHtml(stat.status)}</span></td>
                    <td>${stat._count}</td>
                    <td>${formatCurrency(stat._sum.amount || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="card"><div class="error-message">${escapeHtml(error.message)}</div></div>`;
    } finally {
      hideLoading();
    }
  }

  // Merchants View
  async function loadMerchantsView(container, page = 1, filters = {}) {
    try {
      showLoading();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...filters,
      });
      
      const data = await apiCall(`/admin/merchants?${params}`);
      
      container.innerHTML = `
        <div class="card-header">
          <h2>👥 Merchants</h2>
          <p>Manage merchants and their onboarding status</p>
        </div>

        <div class="card">
          <div class="filters">
            <div class="filter-group">
              <label>Search</label>
              <input type="text" id="merchantSearch" placeholder="Email, name, business..." value="${filters.search || ''}">
            </div>
            <div class="filter-group">
              <label>KYC Status</label>
              <select id="merchantKycFilter">
                <option value="">All</option>
                <option value="PENDING" ${filters.kycStatus === 'PENDING' ? 'selected' : ''}>Pending</option>
                <option value="SUBMITTED" ${filters.kycStatus === 'SUBMITTED' ? 'selected' : ''}>Submitted</option>
                <option value="APPROVED" ${filters.kycStatus === 'APPROVED' ? 'selected' : ''}>Approved</option>
                <option value="REJECTED" ${filters.kycStatus === 'REJECTED' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Role</label>
              <select id="merchantRoleFilter">
                <option value="">All</option>
                <option value="USER" ${filters.role === 'USER' ? 'selected' : ''}>User</option>
                <option value="ADMIN" ${filters.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
              </select>
            </div>
            <div class="filter-group" style="justify-content: flex-end;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" id="merchantFilterBtn">Apply Filters</button>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Business</th>
                  <th>KYC Status</th>
                  <th>Transactions</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${data.merchants.length === 0 ? `
                  <tr>
                    <td colspan="7">
                      <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>No merchants found</h3>
                        <p>Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ` : data.merchants.map(merchant => `
                  <tr>
                    <td>${escapeHtml(merchant.email)}</td>
                    <td>${escapeHtml(merchant.firstName + ' ' + merchant.lastName)}</td>
                    <td>${escapeHtml(merchant.businessName || 'N/A')}</td>
                    <td><span class="badge badge-${merchant.kycStatus.toLowerCase()}">${escapeHtml(merchant.kycStatus)}</span></td>
                    <td>${merchant._count.transactions}</td>
                    <td>${formatDate(merchant.createdAt)}</td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="window.AdminDashboard.viewMerchant('${merchant.id}')">View</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          ${renderPagination(data.pagination, page, filters, 'merchants')}
        </div>
      `;

      // Attach filter event
      document.getElementById('merchantFilterBtn').addEventListener('click', () => {
        const newFilters = {
          search: document.getElementById('merchantSearch').value,
          kycStatus: document.getElementById('merchantKycFilter').value,
          role: document.getElementById('merchantRoleFilter').value,
        };
        loadMerchantsView(container, 1, newFilters);
      });
    } catch (error) {
      container.innerHTML = `<div class="card"><div class="error-message">${escapeHtml(error.message)}</div></div>`;
    } finally {
      hideLoading();
    }
  }

  // View Merchant Details
  async function viewMerchant(merchantId) {
    try {
      showLoading();
      const data = await apiCall(`/admin/merchants/${merchantId}`);
      const merchant = data.merchant;

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Merchant Details</h2>
          </div>
          <div>
            <p><strong>Email:</strong> ${escapeHtml(merchant.email)}</p>
            <p><strong>Name:</strong> ${escapeHtml(merchant.firstName + ' ' + merchant.lastName)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(merchant.phoneNumber || 'N/A')}</p>
            <p><strong>Business Name:</strong> ${escapeHtml(merchant.businessName || 'N/A')}</p>
            <p><strong>Registration:</strong> ${escapeHtml(merchant.businessRegistration || 'N/A')}</p>
            <p><strong>Role:</strong> <span class="badge badge-info">${escapeHtml(merchant.role)}</span></p>
            <p><strong>KYC Status:</strong> <span class="badge badge-${merchant.kycStatus.toLowerCase()}">${escapeHtml(merchant.kycStatus)}</span></p>
            ${merchant.kycNotes ? `<p><strong>KYC Notes:</strong> ${escapeHtml(merchant.kycNotes)}</p>` : ''}
            <p><strong>Joined:</strong> ${formatDate(merchant.createdAt)}</p>
            
            <h3 style="margin-top: 20px;">Recent Transactions</h3>
            ${merchant.transactions.length === 0 ? '<p>No transactions yet</p>' : `
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${merchant.transactions.map(tx => `
                      <tr>
                        <td>${formatCurrency(tx.amount)}</td>
                        <td>${escapeHtml(tx.type)}</td>
                        <td><span class="badge badge-${tx.status.toLowerCase()}">${escapeHtml(tx.status)}</span></td>
                        <td>${formatDate(tx.createdAt)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (error) {
      alert('Error loading merchant: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // Transactions View
  async function loadTransactionsView(container, page = 1, filters = {}) {
    try {
      showLoading();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...filters,
      });
      
      const data = await apiCall(`/admin/transactions?${params}`);
      
      container.innerHTML = `
        <div class="card-header">
          <h2>💳 Transactions</h2>
          <p>Search and filter all transactions</p>
        </div>

        <div class="card">
          <div class="filters">
            <div class="filter-group">
              <label>Status</label>
              <select id="txStatusFilter">
                <option value="">All</option>
                <option value="PENDING" ${filters.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                <option value="PROCESSING" ${filters.status === 'PROCESSING' ? 'selected' : ''}>Processing</option>
                <option value="COMPLETED" ${filters.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                <option value="FAILED" ${filters.status === 'FAILED' ? 'selected' : ''}>Failed</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Type</label>
              <select id="txTypeFilter">
                <option value="">All</option>
                <option value="DEPOSIT" ${filters.type === 'DEPOSIT' ? 'selected' : ''}>Deposit</option>
                <option value="WITHDRAWAL" ${filters.type === 'WITHDRAWAL' ? 'selected' : ''}>Withdrawal</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Network</label>
              <select id="txNetworkFilter">
                <option value="">All</option>
                <option value="MTN" ${filters.network === 'MTN' ? 'selected' : ''}>MTN</option>
                <option value="VODAFONE" ${filters.network === 'VODAFONE' ? 'selected' : ''}>Vodafone</option>
                <option value="AIRTELTIGO" ${filters.network === 'AIRTELTIGO' ? 'selected' : ''}>AirtelTigo</option>
              </select>
            </div>
            <div class="filter-group" style="justify-content: flex-end;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" id="txFilterBtn">Apply Filters</button>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Network</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${data.transactions.length === 0 ? `
                  <tr>
                    <td colspan="8">
                      <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>No transactions found</h3>
                      </div>
                    </td>
                  </tr>
                ` : data.transactions.map(tx => `
                  <tr>
                    <td><code>${escapeHtml(tx.id.substring(0, 8))}</code></td>
                    <td>${escapeHtml(tx.user.email)}</td>
                    <td>${formatCurrency(tx.amount)}</td>
                    <td>${escapeHtml(tx.type)}</td>
                    <td><span class="badge badge-${tx.status.toLowerCase()}">${escapeHtml(tx.status)}</span></td>
                    <td>${escapeHtml(tx.network || 'N/A')}</td>
                    <td>${formatDate(tx.createdAt)}</td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="window.AdminDashboard.viewTransaction('${tx.id}')">View</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          ${renderPagination(data.pagination, page, filters, 'transactions')}
        </div>
      `;

      // Attach filter event
      document.getElementById('txFilterBtn').addEventListener('click', () => {
        const newFilters = {
          status: document.getElementById('txStatusFilter').value,
          type: document.getElementById('txTypeFilter').value,
          network: document.getElementById('txNetworkFilter').value,
        };
        loadTransactionsView(container, 1, newFilters);
      });
    } catch (error) {
      container.innerHTML = `<div class="card"><div class="error-message">${escapeHtml(error.message)}</div></div>`;
    } finally {
      hideLoading();
    }
  }

  // View Transaction Details
  async function viewTransaction(txId) {
    try {
      showLoading();
      const data = await apiCall(`/admin/transactions/${txId}`);
      const tx = data.transaction;

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Transaction Details</h2>
          </div>
          <div>
            <p><strong>ID:</strong> <code>${escapeHtml(tx.id)}</code></p>
            <p><strong>Merchant:</strong> ${escapeHtml(tx.user.email)}</p>
            <p><strong>Amount:</strong> ${formatCurrency(tx.amount)}</p>
            <p><strong>Type:</strong> ${escapeHtml(tx.type)}</p>
            <p><strong>Status:</strong> <span class="badge badge-${tx.status.toLowerCase()}">${escapeHtml(tx.status)}</span></p>
            <p><strong>Network:</strong> ${escapeHtml(tx.network || 'N/A')}</p>
            <p><strong>Mobile Number:</strong> ${escapeHtml(tx.mobileNumber || 'N/A')}</p>
            <p><strong>External Ref:</strong> ${escapeHtml(tx.externalReference || 'N/A')}</p>
            <p><strong>Details:</strong> ${escapeHtml(tx.details || 'N/A')}</p>
            <p><strong>Created:</strong> ${formatDate(tx.createdAt)}</p>
            <p><strong>Updated:</strong> ${formatDate(tx.updatedAt)}</p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-warning" onclick="window.AdminDashboard.updateTransactionStatus('${tx.id}')">Update Status</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (error) {
      alert('Error loading transaction: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // Update Transaction Status
  async function updateTransactionStatus(txId) {
    const status = prompt('Enter new status (PENDING, PROCESSING, COMPLETED, FAILED):');
    if (!status) return;

    const notes = prompt('Enter notes (optional):');

    try {
      showLoading();
      await apiCall(`/admin/transactions/${txId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: status.toUpperCase(), notes }),
      });

      alert('Transaction status updated successfully');
      document.querySelector('.modal')?.remove();
      loadView(currentView);
    } catch (error) {
      alert('Error updating transaction: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // KYC View
  async function loadKYCView(container, page = 1) {
    try {
      showLoading();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        kycStatus: 'SUBMITTED',
      });
      
      const data = await apiCall(`/admin/merchants?${params}`);
      
      container.innerHTML = `
        <div class="card-header">
          <h2>✅ KYC Review</h2>
          <p>Review and approve merchant KYC submissions</p>
        </div>

        <div class="card">
          ${data.merchants.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">✅</div>
              <h3>No pending KYC reviews</h3>
              <p>All KYC submissions have been reviewed</p>
            </div>
          ` : `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Business</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.merchants.map(merchant => `
                    <tr>
                      <td>${escapeHtml(merchant.email)}</td>
                      <td>${escapeHtml(merchant.firstName + ' ' + merchant.lastName)}</td>
                      <td>${escapeHtml(merchant.businessName || 'N/A')}</td>
                      <td>${formatDate(merchant.kycSubmittedAt)}</td>
                      <td>
                        <button class="btn btn-sm btn-success" onclick="window.AdminDashboard.reviewKYC('${merchant.id}', 'APPROVED')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="window.AdminDashboard.reviewKYC('${merchant.id}', 'REJECTED')">Reject</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${renderPagination(data.pagination, page, {}, 'kyc')}
          `}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="card"><div class="error-message">${escapeHtml(error.message)}</div></div>`;
    } finally {
      hideLoading();
    }
  }

  // Review KYC
  async function reviewKYC(merchantId, status) {
    const notes = prompt(`Enter notes for ${status} decision:`);
    if (notes === null) return;

    try {
      showLoading();
      await apiCall(`/admin/merchants/${merchantId}/kyc`, {
        method: 'PATCH',
        body: JSON.stringify({ kycStatus: status, kycNotes: notes }),
      });

      alert(`KYC ${status.toLowerCase()} successfully`);
      loadView(currentView);
    } catch (error) {
      alert('Error updating KYC: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // Payouts View
  async function loadPayoutsView(container, page = 1) {
    try {
      showLoading();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      const data = await apiCall(`/admin/payouts/pending?${params}`);
      
      container.innerHTML = `
        <div class="card-header">
          <h2>💰 Pending Payouts</h2>
          <p>Review and process withdrawal requests</p>
        </div>

        <div class="card">
          ${data.payouts.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">💰</div>
              <h3>No pending payouts</h3>
              <p>All payouts have been processed</p>
            </div>
          ` : `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Mobile</th>
                    <th>Network</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.payouts.map(payout => `
                    <tr>
                      <td>${escapeHtml(payout.user.email)}</td>
                      <td>${formatCurrency(payout.amount)}</td>
                      <td><span class="badge badge-${payout.status.toLowerCase()}">${escapeHtml(payout.status)}</span></td>
                      <td>${escapeHtml(payout.mobileNumber || 'N/A')}</td>
                      <td>${escapeHtml(payout.network || 'N/A')}</td>
                      <td>${formatDate(payout.createdAt)}</td>
                      <td>
                        <button class="btn btn-sm btn-success" onclick="window.AdminDashboard.processPayout('${payout.id}', 'COMPLETED')">Complete</button>
                        <button class="btn btn-sm btn-danger" onclick="window.AdminDashboard.processPayout('${payout.id}', 'FAILED')">Fail</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${renderPagination(data.pagination, page, {}, 'payouts')}
          `}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="card"><div class="error-message">${escapeHtml(error.message)}</div></div>`;
    } finally {
      hideLoading();
    }
  }

  // Process Payout
  async function processPayout(payoutId, status) {
    const notes = prompt(`Enter notes for ${status} status:`);
    if (notes === null) return;

    try {
      showLoading();
      await apiCall(`/admin/transactions/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });

      alert(`Payout ${status.toLowerCase()} successfully`);
      loadView(currentView);
    } catch (error) {
      alert('Error processing payout: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // Audit Logs View
  async function loadAuditLogsView(container, page = 1, filters = {}) {
    try {
      showLoading();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...filters,
      });
      
      const data = await apiCall(`/admin/audit-logs?${params}`);
      
      container.innerHTML = `
        <div class="card-header">
          <h2>📋 Audit Logs</h2>
          <p>Track all admin actions and system events</p>
        </div>

        <div class="card">
          <div class="filters">
            <div class="filter-group">
              <label>Action</label>
              <input type="text" id="auditActionFilter" placeholder="e.g., KYC_APPROVED" value="${filters.action || ''}">
            </div>
            <div class="filter-group">
              <label>Resource Type</label>
              <input type="text" id="auditResourceFilter" placeholder="e.g., User" value="${filters.resourceType || ''}">
            </div>
            <div class="filter-group" style="justify-content: flex-end;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" id="auditFilterBtn">Apply Filters</button>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                ${data.logs.length === 0 ? `
                  <tr>
                    <td colspan="5">
                      <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>No audit logs found</h3>
                      </div>
                    </td>
                  </tr>
                ` : data.logs.map(log => `
                  <tr>
                    <td>${formatDate(log.createdAt)}</td>
                    <td>${escapeHtml(log.user.email)}</td>
                    <td><code>${escapeHtml(log.action)}</code></td>
                    <td>${escapeHtml(log.resourceType)}${log.resourceId ? ` (${log.resourceId.substring(0, 8)})` : ''}</td>
                    <td>${escapeHtml(log.ipAddress || 'N/A')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          ${renderPagination(data.pagination, page, filters, 'audit')}
        </div>
      `;

      // Attach filter event
      document.getElementById('auditFilterBtn').addEventListener('click', () => {
        const newFilters = {
          action: document.getElementById('auditActionFilter').value,
          resourceType: document.getElementById('auditResourceFilter').value,
        };
        loadAuditLogsView(container, 1, newFilters);
      });
    } catch (error) {
      container.innerHTML = `<div class="card"><div class="error-message">${escapeHtml(error.message)}</div></div>`;
    } finally {
      hideLoading();
    }
  }

  // Render Pagination
  function renderPagination(pagination, currentPage, filters, viewName) {
    if (pagination.totalPages <= 1) return '';

    const prevPage = currentPage - 1;
    const nextPage = currentPage + 1;
    const filtersJson = JSON.stringify(filters).replace(/"/g, '&quot;');

    return `
      <div class="pagination">
        <button ${pagination.page === 1 ? 'disabled' : ''} 
          onclick="window.AdminDashboard.loadViewWithPagination('${viewName}', ${prevPage}, JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(filters))}')))"
          ${pagination.page === 1 ? '' : ''}>
          Previous
        </button>
        <span class="page-info">
          Page ${pagination.page} of ${pagination.totalPages}
        </span>
        <button ${pagination.page === pagination.totalPages ? 'disabled' : ''} 
          onclick="window.AdminDashboard.loadViewWithPagination('${viewName}', ${nextPage}, JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(filters))}')))"
          ${pagination.page === pagination.totalPages ? '' : ''}>
          Next
        </button>
      </div>
    `;
  }

  // Helper to load views with pagination
  function loadViewWithPagination(viewName, page, filters) {
    const container = document.getElementById('viewContainer');
    switch(viewName) {
      case 'merchants':
        loadMerchantsView(container, page, filters);
        break;
      case 'transactions':
        loadTransactionsView(container, page, filters);
        break;
      case 'kyc':
        loadKYCView(container, page);
        break;
      case 'payouts':
        loadPayoutsView(container, page);
        break;
      case 'audit':
        loadAuditLogsView(container, page, filters);
        break;
    }
  }

  // Initialize
  async function init() {
    // Setup login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Setup menu navigation
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        loadView(view);
      });
    });

    // Check if already logged in
    if (authToken) {
      try {
        showLoading();
        const profile = await apiCall('/auth/profile');
        
        if (profile.user.role === 'ADMIN') {
          currentUser = profile.user;
          showDashboard();
        } else {
          handleLogout();
        }
      } catch (error) {
        handleLogout();
      } finally {
        hideLoading();
      }
    } else {
      showLogin();
    }
  }

  // Expose public API
  window.AdminDashboard = {
    viewMerchant,
    viewTransaction,
    updateTransactionStatus,
    reviewKYC,
    processPayout,
    loadViewWithPagination,
  };

  // Start the app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
