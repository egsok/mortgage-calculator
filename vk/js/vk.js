/**
 * VK Mini App integration
 * Handles initialization, user data, and communication with bot/CRM
 *
 * VK Bridge docs: https://dev.vk.com/ru/bridge/overview
 */

const VKApp = {
    // VK Bridge instance (loaded via CDN)
    bridge: null,

    // User data
    user: null,

    // Start parameter (from deep link)
    startParam: null,

    // API proxy endpoint (ключ хранится на сервере в api.php)
    apiEndpoint: '../api.php',

    // VK App ID
    appId: 54401368,

    /**
     * Initialize VK Mini App
     * @returns {boolean} Success status
     */
    init() {
        // Check if VK Bridge is loaded
        if (typeof vkBridge === 'undefined') {
            console.warn('VK Bridge SDK not loaded');
            this.initMockMode();
            return false;
        }

        this.bridge = vkBridge;

        // Send init event (required for VK Mini Apps)
        this.bridge.send('VKWebAppInit')
            .then(() => console.log('VK Bridge initialized'))
            .catch((e) => console.warn('VK Bridge init error:', e));

        // Parse launch params from URL
        this.parseLaunchParams();

        // Check if we're actually inside VK (has user_id)
        if (!this.user) {
            console.warn('Not running inside VK, using mock mode');
            this.initMockMode();
            return false;
        }

        // Configure WebApp appearance
        this.configure();

        console.log('VK Mini App initialized', {
            user: this.user,
            startParam: this.startParam,
            platform: this.getPlatform()
        });

        return true;
    },

    /**
     * Parse VK launch parameters from URL
     * VK passes params like: ?vk_user_id=123&vk_app_id=456&vk_ref=...
     */
    parseLaunchParams() {
        const params = new URLSearchParams(window.location.search);

        const vkUserId = params.get('vk_user_id');
        if (vkUserId) {
            this.user = {
                id: parseInt(vkUserId, 10),
                first_name: params.get('vk_first_name') || '',
                last_name: params.get('vk_last_name') || ''
            };
        }

        // VK ref parameter (similar to Telegram start_param)
        this.startParam = params.get('vk_ref') || '';
    },

    /**
     * Initialize mock mode for browser testing
     */
    initMockMode() {
        console.log('Running in mock mode (browser testing)');
        this.user = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User'
        };
        this.startParam = 'test';
    },

    /**
     * Configure WebApp appearance
     */
    configure() {
        if (!this.bridge) return;

        // Set status bar style (dark theme)
        this.bridge.send('VKWebAppSetViewSettings', {
            status_bar_style: 'light',
            action_bar_color: '#0F172A'
        }).catch(() => {});

        // Resize window on desktop to show full content
        this.resizeWindow();
    },

    /**
     * Resize the iframe window (desktop only)
     * VK allows height from 500 to 4050 pixels
     */
    resizeWindow() {
        if (!this.bridge) return;

        const platform = this.getPlatform();

        // Only resize on desktop platforms (iframe)
        if (platform === 'desktop_web' || platform === 'web') {
            this.bridge.send('VKWebAppResizeWindow', {
                height: 1160 // Fit all fields + button + padding
            })
            .then(() => console.log('Window resized to 1150px'))
            .catch((e) => console.debug('Resize not supported:', e));
        }
    },

    /**
     * Get platform info
     * @returns {string} Platform name
     */
    getPlatform() {
        const params = new URLSearchParams(window.location.search);
        return params.get('vk_platform') || 'unknown';
    },

    /**
     * Trigger haptic feedback
     * @param {string} type - 'impact', 'notification', or 'selection'
     * @param {string} style - For impact: 'light', 'medium', 'heavy'
     *                         For notification: 'error', 'success', 'warning'
     */
    haptic(type = 'impact', style = 'light') {
        if (!this.bridge) return;

        try {
            switch (type) {
                case 'impact':
                    this.bridge.send('VKWebAppTapticImpactOccurred', {
                        style: style // 'light', 'medium', 'heavy'
                    });
                    break;
                case 'notification':
                    this.bridge.send('VKWebAppTapticNotificationOccurred', {
                        type: style // 'error', 'success', 'warning'
                    });
                    break;
                case 'selection':
                    this.bridge.send('VKWebAppTapticSelectionChanged');
                    break;
            }
        } catch (e) {
            // Haptic may not be supported on all platforms
            console.debug('Haptic not available:', e);
        }
    },

    /**
     * Send calculator results to SaleBot CRM via server proxy
     * Каждый параметр сохраняется как отдельная переменная клиента
     * @param {Object} data - Calculator results and input data
     * @returns {Promise<boolean>} Success status
     */
    async sendToSaleBot(data) {
        if (!this.user) {
            console.warn('No user data available');
            return false;
        }

        // Отправляем с platform: 'vk' для использования vk_callback
        const payload = {
            platform: 'vk',
            user_id: this.user.id,
            message: 'calculator_result',
            calc_apartment_price: data.input.apartmentPrice,
            calc_down_payment_pct: data.input.downPaymentPercent,
            calc_income: data.input.income,
            calc_expenses: data.input.expenses,
            calc_savings: data.input.savings,
            calc_monthly_savings: data.monthlySavings,
            calc_target_amount: Math.round(data.target),
            calc_result_months: data.monthsCurrent === Infinity ? -1 : Math.ceil(data.monthsCurrent),
            calc_scenario_type: data.scenarioType,
            calc_term_category: data.termCategory,
            calc_start_param: this.startParam || '',
            calc_timestamp: new Date().toISOString(),
            // Подушка безопасности в месяцах (накоплено / расходы)
            cushion_months: data.input.expenses > 0
                ? Math.round((data.input.savings / data.input.expenses) * 10) / 10
                : 0
        };

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            console.log('Data sent to CRM successfully');
            return true;
        } catch (error) {
            console.error('Failed to send data to CRM:', error);
            return false;
        }
    },

    /**
     * Request permission to send messages from community
     * @param {string} reason - Reason/key for the request (e.g., 'checklist')
     * @returns {Promise<boolean>} True if permission granted
     */
    async requestMessagesPermission(reason = 'checklist') {
        if (!this.bridge) {
            console.warn('VK Bridge not available');
            return false;
        }

        try {
            const data = await this.bridge.send('VKWebAppAllowMessagesFromGroup', {
                group_id: 684295,
                key: `${reason}_${this.user?.id}_${Date.now()}`
            });

            if (data.result) {
                console.log('User granted messages permission');
                this.haptic('notification', 'success');
                return true;
            }
            return false;
        } catch (error) {
            console.log('Messages permission denied or error:', error);
            this.haptic('notification', 'error');
            return false;
        }
    },

    /**
     * Request checklist and notify SaleBot
     * @returns {Promise<boolean>} Success status
     */
    async requestChecklist() {
        // First request permission
        const granted = await this.requestMessagesPermission('checklist');

        if (!granted) {
            return false;
        }

        // Notify SaleBot that user wants checklist
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: 'vk',
                    user_id: this.user?.id,
                    message: 'checklist_request',
                    checklist_type: 'financial_holes_it',
                    start_param: this.startParam || ''
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            console.log('Checklist request sent to CRM');
            return true;
        } catch (error) {
            console.error('Failed to send checklist request:', error);
            return false;
        }
    },

    /**
     * Close the Mini App and return to VK
     */
    close() {
        if (this.bridge) {
            this.haptic('notification', 'success');
            this.bridge.send('VKWebAppClose', { status: 'success' })
                .catch(() => {
                    // Fallback - try to go back in history
                    window.history.back();
                });
        } else {
            // Mock mode - just log
            console.log('Would close Mini App and return to VK');
        }
    },

    /**
     * Show native alert
     * @param {string} message - Alert message
     * @returns {Promise<void>}
     */
    showAlert(message) {
        return new Promise((resolve) => {
            if (this.bridge) {
                this.bridge.send('VKWebAppAlert', { message })
                    .then(resolve)
                    .catch(() => {
                        // Fallback to browser alert
                        alert(message);
                        resolve();
                    });
            } else {
                alert(message);
                resolve();
            }
        });
    },

    /**
     * Show native confirmation dialog
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>}
     */
    showConfirm(message) {
        return new Promise((resolve) => {
            // VK doesn't have native confirm, use browser
            resolve(confirm(message));
        });
    },

    /**
     * Get platform info
     * @returns {Object} Platform information
     */
    getPlatformInfo() {
        const params = new URLSearchParams(window.location.search);

        return {
            platform: params.get('vk_platform') || 'browser',
            version: params.get('vk_app_id') || 'mock',
            appId: this.appId
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VKApp;
}
