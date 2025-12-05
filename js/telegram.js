/**
 * Telegram Mini App integration
 * Handles initialization, user data, and communication with bot/CRM
 */

const TelegramApp = {
    // Telegram WebApp instance
    tg: null,

    // User data
    user: null,

    // Start parameter (from deep link)
    startParam: null,

    // SaleBot API configuration
    // TODO: Replace with actual API key before deployment
    salebot: {
        apiKey: 'YOUR_SALEBOT_API_KEY',
        baseUrl: 'https://chatter.salebot.pro/api'
    },

    /**
     * Initialize Telegram Mini App
     * @returns {boolean} Success status
     */
    init() {
        // Check if running in Telegram (not just if SDK loaded)
        // SDK loads in browser too, but initData will be empty
        if (typeof window.Telegram === 'undefined' || !window.Telegram.WebApp) {
            console.warn('Telegram WebApp SDK not loaded');
            this.initMockMode();
            return false;
        }

        this.tg = window.Telegram.WebApp;

        // Check if we're actually inside Telegram (initData present)
        // In browser, SDK loads but initData is empty
        const isRealTelegram = this.tg.initData && this.tg.initData.length > 0;

        if (!isRealTelegram) {
            console.warn('Not running inside Telegram, using mock mode');
            this.initMockMode();
            return false;
        }

        // Get user data
        if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
            this.user = this.tg.initDataUnsafe.user;
        }

        // Get start parameter from deep link
        if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.start_param) {
            this.startParam = this.tg.initDataUnsafe.start_param;
        }

        // Configure WebApp
        this.configure();

        // Signal that app is ready
        this.tg.ready();

        // Request write access for future messages
        this.requestWriteAccess();

        console.log('Telegram WebApp initialized', {
            user: this.user,
            startParam: this.startParam,
            platform: this.tg.platform,
            version: this.tg.version
        });

        return true;
    },

    /**
     * Initialize mock mode for browser testing
     */
    initMockMode() {
        console.log('Running in mock mode (browser testing)');
        this.user = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
        };
        this.startParam = 'test';
    },

    /**
     * Configure WebApp appearance and behavior
     */
    configure() {
        if (!this.tg) return;

        // Expand to full height
        this.tg.expand();

        // Set header color to match our theme
        this.tg.setHeaderColor('#0F172A');
        this.tg.setBackgroundColor('#0F172A');

        // Disable closing confirmation (we handle navigation ourselves)
        if (this.tg.disableClosingConfirmation) {
            this.tg.disableClosingConfirmation();
        }

        // Enable vertical swipes to close
        if (this.tg.enableVerticalSwipes) {
            this.tg.enableVerticalSwipes();
        }
    },

    /**
     * Request write access to send messages
     */
    requestWriteAccess() {
        if (!this.tg || !this.tg.requestWriteAccess) return;

        this.tg.requestWriteAccess((granted) => {
            console.log('Write access:', granted ? 'granted' : 'denied');
        });
    },

    /**
     * Trigger haptic feedback
     * @param {string} type - 'impact', 'notification', or 'selection'
     * @param {string} style - For impact: 'light', 'medium', 'heavy', 'rigid', 'soft'
     *                         For notification: 'error', 'success', 'warning'
     */
    haptic(type = 'impact', style = 'light') {
        if (!this.tg || !this.tg.HapticFeedback) return;

        const hf = this.tg.HapticFeedback;

        switch (type) {
            case 'impact':
                hf.impactOccurred(style);
                break;
            case 'notification':
                hf.notificationOccurred(style);
                break;
            case 'selection':
                hf.selectionChanged();
                break;
        }
    },

    /**
     * Send calculator results to SaleBot CRM
     * @param {Object} data - Calculator results and input data
     * @returns {Promise<boolean>} Success status
     */
    async sendToSaleBot(data) {
        if (!this.user) {
            console.warn('No user data available');
            return false;
        }

        const payload = {
            user_id: this.user.id,
            message: JSON.stringify({
                action: 'calculator_result',
                apartment_price: data.input.apartmentPrice,
                down_payment_pct: data.input.downPaymentPercent,
                income: data.input.income,
                expenses: data.input.expenses,
                savings: data.input.savings,
                result_months: Math.ceil(data.monthsCurrent),
                target_amount: data.target,
                scenario_type: data.scenarioType,
                start_param: this.startParam,
                timestamp: new Date().toISOString()
            })
        };

        try {
            const response = await fetch(
                `${this.salebot.baseUrl}/${this.salebot.apiKey}/tg_callback`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            console.log('Data sent to SaleBot successfully');
            return true;
        } catch (error) {
            console.error('Failed to send data to SaleBot:', error);
            return false;
        }
    },

    /**
     * Close the Mini App and return to bot
     */
    close() {
        if (this.tg) {
            this.haptic('notification', 'success');
            this.tg.close();
        } else {
            // Mock mode - just log
            console.log('Would close Mini App and return to bot');
        }
    },

    /**
     * Show native alert
     * @param {string} message - Alert message
     * @returns {Promise<void>}
     */
    showAlert(message) {
        return new Promise((resolve) => {
            if (this.tg && this.tg.showAlert) {
                this.tg.showAlert(message, resolve);
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
            if (this.tg && this.tg.showConfirm) {
                this.tg.showConfirm(message, resolve);
            } else {
                resolve(confirm(message));
            }
        });
    },

    /**
     * Get platform info
     * @returns {Object} Platform information
     */
    getPlatformInfo() {
        if (!this.tg) {
            return { platform: 'browser', version: 'mock' };
        }

        return {
            platform: this.tg.platform,
            version: this.tg.version,
            colorScheme: this.tg.colorScheme,
            isExpanded: this.tg.isExpanded,
            viewportHeight: this.tg.viewportHeight,
            viewportStableHeight: this.tg.viewportStableHeight
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramApp;
}
