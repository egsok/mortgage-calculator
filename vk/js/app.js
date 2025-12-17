/**
 * Main application controller (VK version)
 * Coordinates UI, calculator logic, and VK integration
 */

const App = {
    // DOM elements cache
    elements: {},

    // Current screen
    currentScreen: 'input',

    // Last calculation results
    lastResults: null,

    // LocalStorage key
    STORAGE_KEY: 'mortgage_calculator_values',

    /**
     * Initialize the application
     */
    init() {
        // Cache DOM elements
        this.cacheElements();

        // Initialize VK Mini App
        VKApp.init();

        // Load saved values from localStorage
        this.loadSavedValues();

        // Setup event listeners
        this.setupEventListeners();

        // Update all slider visuals
        this.updateAllSliders();

        console.log('App initialized (VK version)');
    },

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Screens
            screenInput: document.getElementById('screen-input'),
            screenResult: document.getElementById('screen-result'),

            // Scroll indicator
            scrollIndicator: document.getElementById('scroll-indicator'),

            // Form
            form: document.getElementById('calculator-form'),
            calculateBtn: document.getElementById('calculate-btn'),

            // Input fields
            apartmentPrice: document.getElementById('apartment-price'),
            downPayment: document.getElementById('down-payment'),
            income: document.getElementById('income'),
            expenses: document.getElementById('expenses'),
            savings: document.getElementById('savings'),

            // Sliders
            apartmentPriceSlider: document.getElementById('apartment-price-slider'),
            downPaymentSlider: document.getElementById('down-payment-slider'),
            incomeSlider: document.getElementById('income-slider'),
            expensesSlider: document.getElementById('expenses-slider'),
            savingsSlider: document.getElementById('savings-slider'),

            // Result elements
            resultGoal: document.getElementById('result-goal'),
            resultGoalLabel: document.getElementById('result-goal-label'),
            resultTimeline: document.getElementById('result-timeline'),
            resultCurrent: document.getElementById('result-current'),
            resultPlus50: document.getElementById('result-plus50'),
            resultPlus100: document.getElementById('result-plus100'),
            resultWarning: document.getElementById('result-warning'),
            resultSuccess: document.getElementById('result-success'),

            // Action buttons
            backToBot: document.getElementById('back-to-bot'),
            recalculate: document.getElementById('recalculate'),

            // Dynamic hints
            apartmentPriceHint: document.getElementById('apartment-price-hint'),
            downPaymentHint: document.getElementById('down-payment-hint')
        };
    },

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Form submission
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCalculate();
        });

        // Input formatting and slider sync
        this.setupInputSliderPair('apartmentPrice', 'apartmentPriceSlider', false, () => this.updateApartmentPriceHint());
        this.setupInputSliderPair('downPayment', 'downPaymentSlider', true, () => this.updateDownPaymentHint());
        this.setupInputSliderPair('income', 'incomeSlider');
        this.setupInputSliderPair('expenses', 'expensesSlider');
        this.setupInputSliderPair('savings', 'savingsSlider');

        // Initial hint updates
        this.updateApartmentPriceHint();
        this.updateDownPaymentHint();

        // Result screen buttons
        this.elements.backToBot.addEventListener('click', () => this.handleBackToBot());
        this.elements.recalculate.addEventListener('click', () => this.showScreen('input'));

        // Scroll indicator
        this.setupScrollIndicator();
    },

    /**
     * Setup scroll indicator that shows when content is scrollable
     */
    setupScrollIndicator() {
        const indicator = this.elements.scrollIndicator;
        if (!indicator) return;

        // Check if content is scrollable and show indicator
        const checkScroll = () => {
            const screen = this.elements.screenInput.classList.contains('active')
                ? this.elements.screenInput
                : this.elements.screenResult;

            const isScrollable = screen.scrollHeight > screen.clientHeight;
            const isNearBottom = screen.scrollTop + screen.clientHeight >= screen.scrollHeight - 50;
            const hasScrolled = screen.scrollTop > 20;

            // Show indicator if scrollable, not near bottom, and hasn't scrolled much
            if (isScrollable && !isNearBottom && !hasScrolled) {
                indicator.classList.add('visible');
            } else {
                indicator.classList.remove('visible');
            }
        };

        // Initial check after small delay (for animations)
        setTimeout(checkScroll, 600);

        // Check on scroll
        this.elements.screenInput.addEventListener('scroll', checkScroll, { passive: true });
        this.elements.screenResult.addEventListener('scroll', checkScroll, { passive: true });

        // Check on window resize
        window.addEventListener('resize', checkScroll, { passive: true });
    },

    /**
     * Setup bidirectional sync between input and slider
     * @param {string} inputKey - Key for input element
     * @param {string} sliderKey - Key for slider element
     * @param {boolean} isPercent - Whether this is a percentage field
     * @param {Function} onUpdate - Optional callback on value change
     */
    setupInputSliderPair(inputKey, sliderKey, isPercent = false, onUpdate = null) {
        const input = this.elements[inputKey];
        const slider = this.elements[sliderKey];

        // Input → Slider sync
        input.addEventListener('input', () => {
            const value = Format.parse(input.value);
            slider.value = value;
            this.updateSliderTrack(slider);
            if (onUpdate) onUpdate();
            VKApp.haptic('selection');
        });

        input.addEventListener('blur', () => {
            // Format on blur
            const value = Format.parse(input.value);
            input.value = isPercent ? value : Format.number(value);
            this.saveValues();
        });

        input.addEventListener('focus', () => {
            // Select all on focus for easy editing
            input.select();
        });

        // Slider → Input sync
        slider.addEventListener('input', () => {
            const value = parseInt(slider.value, 10);
            input.value = isPercent ? value : Format.number(value);
            this.updateSliderTrack(slider);
            if (onUpdate) onUpdate();
        });

        slider.addEventListener('change', () => {
            VKApp.haptic('impact', 'light');
            this.saveValues();
        });
    },

    /**
     * Update slider track fill visual
     * @param {HTMLInputElement} slider - Slider element
     */
    updateSliderTrack(slider) {
        const min = parseInt(slider.min, 10);
        const max = parseInt(slider.max, 10);
        const value = parseInt(slider.value, 10);
        const progress = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
    },

    /**
     * Update all slider tracks
     */
    updateAllSliders() {
        const sliders = [
            this.elements.apartmentPriceSlider,
            this.elements.downPaymentSlider,
            this.elements.incomeSlider,
            this.elements.expensesSlider,
            this.elements.savingsSlider
        ];

        sliders.forEach(slider => this.updateSliderTrack(slider));
    },

    /**
     * Update apartment price hint based on value
     */
    updateApartmentPriceHint() {
        const price = Format.parse(this.elements.apartmentPrice.value);
        let hint = '';

        if (price <= 5000000) {
            hint = 'Студия в регионах';
        } else if (price <= 10000000) {
            hint = '1-комнатная в Москве / 2-комнатная в регионах';
        } else if (price <= 15000000) {
            hint = '2-комнатная в Москве';
        } else if (price <= 25000000) {
            hint = '3-комнатная в Москве';
        } else if (price <= 40000000) {
            hint = 'Большая квартира или квартира в центре';
        } else if (price <= 60000000) {
            hint = 'Премиум-класс';
        } else {
            hint = 'Элитная недвижимость';
        }

        this.elements.apartmentPriceHint.textContent = hint;
    },

    /**
     * Update down payment hint based on value
     */
    updateDownPaymentHint() {
        const percent = Format.parse(this.elements.downPayment.value);
        let hint = '';

        if (percent < 20) {
            hint = 'Минимальный взнос, высокая ставка';
        } else if (percent < 30) {
            hint = 'Небольшой взнос';
        } else if (percent < 50) {
            hint = 'Стандартный взнос';
        } else if (percent < 80) {
            hint = 'Большой взнос — выгодные условия';
        } else if (percent < 100) {
            hint = 'Почти без ипотеки';
        } else {
            hint = 'Покупка без ипотеки';
        }

        this.elements.downPaymentHint.textContent = hint;
    },

    /**
     * Get current form values
     * @returns {Object} Form values
     */
    getFormValues() {
        return {
            apartmentPrice: Format.parse(this.elements.apartmentPrice.value),
            downPaymentPercent: Format.parse(this.elements.downPayment.value),
            income: Format.parse(this.elements.income.value),
            expenses: Format.parse(this.elements.expenses.value),
            savings: Format.parse(this.elements.savings.value)
        };
    },

    /**
     * Handle calculate button click
     */
    async handleCalculate() {
        const values = this.getFormValues();

        // Validate
        const validation = Calculator.validate(values);
        if (!validation.isValid) {
            VKApp.haptic('notification', 'error');
            await VKApp.showAlert(validation.errors.join('\n'));
            return;
        }

        // Calculate
        this.lastResults = Calculator.calculate(values);

        // Update UI
        this.displayResults(this.lastResults);

        // Send to CRM
        this.sendResultsToCRM();

        // Haptic feedback
        VKApp.haptic('notification', 'success');

        // Show result screen
        this.showScreen('result');
    },

    /**
     * Display calculation results
     * @param {Object} results - Calculation results
     */
    displayResults(results) {
        // Goal amount
        this.elements.resultGoal.textContent = Format.currency(results.target);

        // Update goal label based on down payment percentage
        if (results.input.downPaymentPercent === 100) {
            this.elements.resultGoalLabel.textContent = 'квартира без ипотеки';
        } else {
            this.elements.resultGoalLabel.textContent = 'первоначальный взнос';
        }

        // Reset visibility
        this.elements.resultTimeline.classList.remove('hidden');
        this.elements.resultWarning.classList.add('hidden');
        this.elements.resultSuccess.classList.add('hidden');

        // Handle different scenarios
        switch (results.scenarioType) {
            case 'already_saved':
                this.elements.resultTimeline.classList.add('hidden');
                this.elements.resultSuccess.classList.remove('hidden');
                break;

            case 'no_savings':
                this.elements.resultTimeline.classList.add('hidden');
                this.elements.resultWarning.classList.remove('hidden');
                break;

            case 'normal':
            default:
                // Update timeline values
                let currentText = Format.duration(results.monthsCurrent);

                // Add term category message
                if (results.termCategory === 'very_long') {
                    currentText += '\n(очень долго — стоит пересмотреть план)';
                } else if (results.termCategory === 'long') {
                    currentText += '\n(долго, есть способы ускорить)';
                }

                this.elements.resultCurrent.textContent = currentText;
                this.elements.resultPlus50.textContent = Format.duration(results.monthsPlus50k);
                this.elements.resultPlus100.textContent = Format.duration(results.monthsPlus100k);
                break;
        }
    },

    /**
     * Send results to CRM in background
     */
    async sendResultsToCRM() {
        if (!this.lastResults) return;

        try {
            await VKApp.sendToSaleBot(this.lastResults);
        } catch (error) {
            console.error('Failed to send to CRM:', error);
            // Don't show error to user - CRM sync is not critical
        }
    },

    /**
     * Handle back to bot button
     */
    handleBackToBot() {
        VKApp.close();
    },

    /**
     * Switch between screens
     * @param {string} screen - 'input' or 'result'
     */
    showScreen(screen) {
        // Hide scroll indicator during transition
        if (this.elements.scrollIndicator) {
            this.elements.scrollIndicator.classList.remove('visible');
        }

        // Add exit class to current screen
        const currentEl = screen === 'input' ? this.elements.screenResult : this.elements.screenInput;
        const nextEl = screen === 'input' ? this.elements.screenInput : this.elements.screenResult;

        currentEl.classList.add('exit');
        currentEl.classList.remove('active');

        // Small delay for animation
        setTimeout(() => {
            currentEl.classList.remove('exit');
            nextEl.classList.add('active');

            // Reset scroll position (both element and window for desktop)
            nextEl.scrollTop = 0;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);

        this.currentScreen = screen;
        VKApp.haptic('impact', 'light');
    },

    /**
     * Save current values to localStorage
     */
    saveValues() {
        const values = this.getFormValues();
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(values));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    },

    /**
     * Load saved values from localStorage
     */
    loadSavedValues() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (!saved) return;

            const values = JSON.parse(saved);

            // Apply saved values
            if (values.apartmentPrice) {
                this.elements.apartmentPrice.value = Format.number(values.apartmentPrice);
                this.elements.apartmentPriceSlider.value = values.apartmentPrice;
            }

            if (values.downPaymentPercent) {
                this.elements.downPayment.value = values.downPaymentPercent;
                this.elements.downPaymentSlider.value = values.downPaymentPercent;
            }

            if (values.income) {
                this.elements.income.value = Format.number(values.income);
                this.elements.incomeSlider.value = values.income;
            }

            if (values.expenses) {
                this.elements.expenses.value = Format.number(values.expenses);
                this.elements.expensesSlider.value = values.expenses;
            }

            if (values.savings !== undefined) {
                this.elements.savings.value = Format.number(values.savings);
                this.elements.savingsSlider.value = values.savings;
            }

            console.log('Loaded saved values:', values);
        } catch (e) {
            console.warn('Could not load from localStorage:', e);
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
