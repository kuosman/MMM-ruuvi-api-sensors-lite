var moment = require('moment');
const request = require('request');
var NodeHelper = require('node_helper');
const { parseGatewayResponse } = require('./ruuviGatewayParser');

module.exports = NodeHelper.create({
    updateTimer: null,

    /**
     * Start
     *
     * @function start start
     */
    start: function () {
        moment.locale(config.language || 'fi');
    },

    /**
     * Socket notification received
     *
     * @function socketNotificationReceived
     * @param {string} notification notification
     * @param {object} payload payload
     */
    socketNotificationReceived: function (notification, payload) {
        if (notification === 'MMM_RUUVI_API_SENSORS_LITE_GET_SENSORS_DATA') {
            this.fetchSensorsData(
                payload.config.apiUrl,
                payload.config.token,
                payload.identifier
            );
        }
    },

    /**
     * Fetches sensors data
     *
     * @function fetchSensorsData
     * @param {string} apiUrl api url
     * @param {string} token api url
     * @param {string} identifier identifier
     */
    fetchSensorsData(apiUrl, token, identifier) {
        var self = this;
        if (token === '') {
            self.sendSocketNotification(
                'MMM_RUUVI_API_SENSORS_LITE_SENSORS_RESPONSE',
                {
                    data: [],
                    identifier: identifier,
                }
            );
        }
        request(
            {
                headers: {
                    'accept-encoding': 'gzip',
                    Authorization: 'Bearer ' + token,
                },
                url: apiUrl + '/sensors-dense?measurements=true',
                method: 'GET',
                gzip: true,
            },
            function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    const data = JSON.parse(body);
                    const sensors = [];
                    if (data.result === 'success') {
                        const sensors = parseGatewayResponse(data);

                        sensors.sort(function (a, b) {
                            var x = a.name.toLowerCase();
                            var y = b.name.toLowerCase();
                            return x < y ? -1 : x > y ? 1 : 0;
                        });
                    }

                    self.sendSocketNotification(
                        'MMM_RUUVI_API_SENSORS_LITE_SENSORS_RESPONSE',
                        {
                            data: sensors,
                            identifier: identifier,
                        }
                    );
                } else {
                    self.sendSocketNotification(
                        'MMM_RUUVI_API_SENSORS_LITE_SENSORS_RESPONSE',
                        {
                            data: [],
                            identifier: identifier,
                        }
                    );
                }
            }
        );
    },
});
