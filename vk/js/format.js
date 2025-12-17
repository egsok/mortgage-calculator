/**
 * Number formatting utilities for the mortgage calculator
 */

const Format = {
    /**
     * Format number with thousand separators (space)
     * @param {number|string} value - The number to format
     * @returns {string} Formatted number string
     */
    number(value) {
        const num = typeof value === 'string' ? this.parse(value) : value;
        if (isNaN(num)) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    /**
     * Parse formatted string to number
     * @param {string} value - The formatted string
     * @returns {number} Parsed number
     */
    parse(value) {
        if (typeof value === 'number') return value;
        return parseInt(value.replace(/\s/g, ''), 10) || 0;
    },

    /**
     * Format currency (number + ₽)
     * @param {number|string} value - The number to format
     * @returns {string} Formatted currency string
     */
    currency(value) {
        return `${this.number(value)} ₽`;
    },

    /**
     * Format months to human readable duration
     * @param {number} months - Number of months
     * @returns {string} Formatted duration string
     */
    duration(months) {
        if (months <= 0) return '0 месяцев';
        if (!isFinite(months)) return '∞';

        const totalMonths = Math.ceil(months);
        const years = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;

        const parts = [];

        if (years > 0) {
            parts.push(this.pluralize(years, 'год', 'года', 'лет'));
        }

        if (remainingMonths > 0) {
            parts.push(this.pluralize(remainingMonths, 'месяц', 'месяца', 'месяцев'));
        }

        return parts.join(' ');
    },

    /**
     * Russian pluralization helper
     * @param {number} n - The number
     * @param {string} one - Form for 1
     * @param {string} few - Form for 2-4
     * @param {string} many - Form for 5-20, 0
     * @returns {string} Number with correct word form
     */
    pluralize(n, one, few, many) {
        const abs = Math.abs(n);
        const mod10 = abs % 10;
        const mod100 = abs % 100;

        let form;
        if (mod100 >= 11 && mod100 <= 19) {
            form = many;
        } else if (mod10 === 1) {
            form = one;
        } else if (mod10 >= 2 && mod10 <= 4) {
            form = few;
        } else {
            form = many;
        }

        return `${n} ${form}`;
    },

    /**
     * Format percentage
     * @param {number|string} value - The percentage value
     * @returns {string} Formatted percentage string
     */
    percent(value) {
        const num = typeof value === 'string' ? this.parse(value) : value;
        return `${num}%`;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Format;
}
