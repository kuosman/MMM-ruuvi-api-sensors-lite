/* global Module */

/*
 * Magic Mirror
 * Module: MMM-ruuvi-api-sensors-lite
 *
 *
 *  By Marko Kuosmanen http://github.com/kuosman
 *  MIT Licenced.
 */
Module.register('MMM-ruuvi-api-sensors-lite', {
    // Default module config.
    defaults: {
        batteryEmptyIcon: 'battery-half', // See free icons: https://fontawesome.com/icons?d=gallery
        updateInterval: 5 * 1000 * 60, // every 5 minutes
        apiUrl: 'https://network.ruuvi.com',
        token: '',
        negativeColor: '#4800FF',
        highlightNegative: true,
        hideNotTodayMeasurement: false
    },

    sensorsData: null,
    updateTimer: null,
    batteryLimit: 2420, // if below this value, show battery empty warning,
    identifier: Date.now(),

    /**
     * Gets styles
     *
     * @function getStyles
     * @returns {Array} styles array
     */
    getStyles: function () {
        return [
            this.file('css/fontawesome/css/all.min.css'),
            this.file('css/styles.css'),
        ];
    },

    /**
     * Gets translations
     * @function getTranslations
     * @returns {Object} translation object
     */
    getTranslations: function () {
        return {
            en: 'translations/en.json',
            fi: 'translations/fi.json',
        };
    },

    /**
     * Gets measurement value HTML style
     * @private
     * @function _getMeasurementValueStyle
     * @param {number} value
     * @returns {string} style
     */
    _getMeasurementValueStyle: function (value) {
        const self = this;
        if (value < 0 && self.config.highlightNegative) {
            return 'style="color:' + self.config.negativeColor + ';"';
        } else return '';
    },

    /**
     * Format decimal number
     * @private
     * @function _formatDecimal
     * @param {number} data number to format
     * @param {number} decimals decimals
     * @returns locale formatted decimal
     */
    _formatDecimal: function (data, decimals = 2) {
        const locale = config.language || 'fi';
        if (!data) return '';
        return (
            Math.round((data + Number.EPSILON) * Math.pow(10, decimals)) /
            Math.pow(10, decimals)
        ).toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    },

    /**
     * Gets row dom.
     * @returns {object} HTML wrapper
     */
    getRowDom: function () {
        const self = this;
        var wrapper = document.createElement('table');
        if (!self.config.sensor === null) {
            wrapper.innerHTML =
                this.translate('configEmpty') + this.name + '.';
            wrapper.className = 'ruuvi-api-sensors-lite small';
            return wrapper;
        }

        if (self.sensorsData === null) {
            wrapper.innerHTML = this.translate('loading');
            wrapper.className = 'ruuvi-api-sensors-lite small';
            return wrapper;
        }
        wrapper.className = 'ruuvi-api-sensors-lite small';

        var batteryEmptyIcon =
            '<span class="battery-empty-icon ' +
            '"><i class="fas fa-' +
            self.config.batteryEmptyIcon +
            '"></i></span>';

        // create dom element of sensor data's
        self.sensorsData.forEach((sensor) => {
            if (
                self.config.hideNotTodayMeasurement &&
                !sensor.isTodayMeasurement
            )
                return;
            const sensorData = document.createElement('tr');
            const sensorName = document.createElement('td');
            sensorName.className = 'name';
            sensorName.innerHTML =
                (sensor.batteryVoltage > self.batteryLimit) || sensor.isRuuviAir
                    ? sensor.name
                    : sensor.name + batteryEmptyIcon;
            const sensorTemperature = document.createElement('td');
            sensorTemperature.className = 'align-right bright temperature';
            sensorTemperature.innerHTML =
                self._formatDecimal(sensor.temperature, 1) + ' &#8451;';
            sensorData.appendChild(sensorName);
            sensorData.appendChild(sensorTemperature);

            wrapper.appendChild(sensorData);
            if (sensor.isRuuviAir) {
                const airQuality = document.createElement('tr');
                const empty = document.createElement('td');
                airQuality.appendChild(empty);

                const iaqLevel = document.createElement('tr');
                const iaqContainer = document.createElement('div');
                iaqContainer.className = 'rating-container';
                for (let i = 1; i <= 5; i++) {
                    const bar = document.createElement('div');
                    bar.classList.add('bar');
                    bar.classList.add('iaq-level-'+sensor.iaqLevel);
                    bar.classList.add('iaq-'+sensor.iaq);
                    if (i <= sensor.iaqLevel) {
                        bar.classList.add('filled');
                    }
                    iaqContainer.appendChild(bar);
                }

                iaqLevel.appendChild(iaqContainer);
                airQuality.appendChild(iaqLevel);
                wrapper.appendChild(airQuality);
            }
        });

        // show upadated timestamp only once and use firs sensor timestamp
        if (self.sensorsData && self.sensorsData[0]) {
            const sensorData = document.createElement('tr');
            const sensorTime = document.createElement('td');
            sensorTime.className = 'light small time';
            sensorTime.colSpan = '3';
            sensorTime.innerHTML = self.sensorsData[0].timestampString;
            sensorData.appendChild(sensorTime);
            wrapper.appendChild(sensorData);
        }
        return wrapper;
    },

    /**
     * Gets dom
     *
     * @function getDom
     * @returns {object} html wrapper
     */
    getDom: function () {
        const self = this;
        return self.getRowDom();
    },

    /**
     * Schedule next fetch
     *
     * @function scheduleNextFetch
     */
    scheduleNextFetch: function () {
        var self = this;
        if (self.sensorsData === null) {
            self.sendSocketNotification(
                'MMM_RUUVI_API_SENSORS_LITE_GET_SENSORS_DATA',
                {
                    config: self.config,
                    identifier: self.identifier,
                }
            );
        } else {
            clearTimeout(self.updateTimer);
            const delay =
                self.config.updateInterval < 1000 * 60
                    ? 1000 * 60
                    : self.config.updateInterval;
            self.updateTimer = setTimeout(function () {
                self.sendSocketNotification(
                    'MMM_RUUVI_API_SENSORS_LITE_GET_SENSORS_DATA',
                    {
                        config: self.config,
                        identifier: self.identifier,
                    }
                );
            }, delay);
        }
    },

    /**
     * Notification received
     *
     * @function  notificationReceived
     * @param {string} notification notification
     */
    notificationReceived: function (notification) {
        if (notification === 'DOM_OBJECTS_CREATED') {
            this.scheduleNextFetch();
        }
    },

    /**
     * Socket notification received
     *
     * @function socketNotificationReceived
     * @param {string} notification notification message
     * @param {object} payload payload
     */
    socketNotificationReceived: function (notification, payload) {
        if (payload.identifier !== this.identifier) return;

        switch (notification) {
            case 'MMM_RUUVI_API_SENSORS_LITE_SENSORS_RESPONSE':
                this.scheduleNextFetch();
                this.sensorsData = payload.data;
                this.updateDom();
                break;
        }
    },
});
