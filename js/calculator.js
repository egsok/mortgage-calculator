/**
 * Calculator logic for mortgage down payment estimation
 */

const Calculator = {
    /**
     * Calculate all results based on input values
     * @param {Object} params - Input parameters
     * @param {number} params.apartmentPrice - Total apartment price
     * @param {number} params.downPaymentPercent - Down payment percentage
     * @param {number} params.income - Monthly income
     * @param {number} params.expenses - Monthly expenses
     * @param {number} params.savings - Current savings
     * @returns {Object} Calculation results
     */
    calculate(params) {
        const {
            apartmentPrice,
            downPaymentPercent,
            income,
            expenses,
            savings
        } = params;

        // Calculate target (down payment goal)
        const target = apartmentPrice * (downPaymentPercent / 100);

        // Calculate remaining amount
        const remaining = Math.max(0, target - savings);

        // Calculate monthly savings rate
        const monthlySavings = income - expenses;

        // Determine the scenario type
        let scenarioType = 'normal';

        if (savings >= target) {
            scenarioType = 'already_saved';
        } else if (monthlySavings <= 0) {
            scenarioType = 'no_savings';
        }

        // Calculate months for different scenarios
        const monthsCurrent = this.calculateMonths(remaining, monthlySavings);
        const monthsPlus50k = this.calculateMonths(remaining, monthlySavings + 50000);
        const monthsPlus100k = this.calculateMonths(remaining, monthlySavings + 100000);

        // Check if it's a long term (> 120 months)
        const isLongTerm = monthsCurrent > 120;

        return {
            target,
            remaining,
            monthlySavings,
            monthsCurrent,
            monthsPlus50k,
            monthsPlus100k,
            scenarioType,
            isLongTerm,
            // Raw input for CRM
            input: {
                apartmentPrice,
                downPaymentPercent,
                income,
                expenses,
                savings
            }
        };
    },

    /**
     * Calculate months to reach goal
     * @param {number} remaining - Remaining amount to save
     * @param {number} monthlyRate - Monthly savings rate
     * @returns {number} Number of months (Infinity if can't save)
     */
    calculateMonths(remaining, monthlyRate) {
        if (remaining <= 0) return 0;
        if (monthlyRate <= 0) return Infinity;
        return remaining / monthlyRate;
    },

    /**
     * Validate input values
     * @param {Object} params - Input parameters
     * @returns {Object} Validation result with isValid and errors
     */
    validate(params) {
        const errors = [];

        if (params.apartmentPrice < 1000000) {
            errors.push('Минимальная стоимость квартиры: 1 000 000 ₽');
        }

        if (params.apartmentPrice > 500000000) {
            errors.push('Максимальная стоимость квартиры: 500 000 000 ₽');
        }

        if (params.downPaymentPercent < 10 || params.downPaymentPercent > 90) {
            errors.push('Первоначальный взнос должен быть от 10% до 90%');
        }

        if (params.income < 10000) {
            errors.push('Минимальный доход: 10 000 ₽');
        }

        if (params.expenses < 0) {
            errors.push('Расходы не могут быть отрицательными');
        }

        if (params.savings < 0) {
            errors.push('Накопления не могут быть отрицательными');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculator;
}
