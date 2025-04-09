/* eslint-disable prettier/prettier */
var moment = require("moment");
const request = require("request");
var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
    updateTimer: null,
    /**
     * Format Hex to bytes
     * @private
     * @function _hexToBytes
     * @param {string} hex hex value
     * @returns {string} byte value
     */
    _hexToBytes: function (hex) {
        const bytes = [];
        for (let c = 0; c < hex.length; c += 2) {
            bytes.push(parseInt(hex.substr(c, 2), 16));
        }
        return bytes;
    },
    /**
     * Format int to hex
     * @private
     * @function _int2Hex
     * @param {string} str int value
     * @returns {string} hex value
     */
    _int2Hex: function (str) {
        return ('0' + str.toString(16).toUpperCase()).slice(-2);
    },
    /**
     * Parse Ruuvi type 3 sensor data
     * @function _parse3
     * @private
     * @param {Object} data sensor data
     * @returns {Object} sensor JSONObject
     */
    _parse3: function (data) {
        const dataString = data.toString('hex');

        const humidityStart = 6;
        const humidityEnd = 8;
        const temperatureStart = 8;
        const temperatureEnd = 12;
        const pressureStart = 12;
        const pressureEnd = 16;
        const accelerationXStart = 16;
        const accelerationXEnd = 20;
        const accelerationYStart = 20;
        const accelerationYEnd = 24;
        const accelerationZStart = 24;
        const accelerationZEnd = 28;
        const batteryStart = 28;
        const batteryEnd = 32;

        let humidity = parseInt(
            dataString.substring(humidityStart, humidityEnd),
            16
        );
        humidity /= 2; // scale

        const temperatureString = dataString.substring(
            temperatureStart,
            temperatureEnd
        );
        let temperature = parseInt(temperatureString.substring(0, 2), 16); // Full degrees
        temperature += parseInt(temperatureString.substring(2, 4), 16) / 100; // Decimals
        if (temperature > 128) {
            // Ruuvi format, sign bit + value
            temperature = temperature - 128;
            temperature = 0 - temperature;
        }

        let pressure = parseInt(
            dataString.substring(pressureStart, pressureEnd),
            16
        ); // uint16_t pascals
        pressure += 50000; // Ruuvi format

        let accelerationX = parseInt(
            dataString.substring(accelerationXStart, accelerationXEnd),
            16
        ); // milli-g
        if (accelerationX > 32767) {
            accelerationX -= 65536;
        } // two's complement

        let accelerationY = parseInt(
            dataString.substring(accelerationYStart, accelerationYEnd),
            16
        ); // milli-g
        if (accelerationY > 32767) {
            accelerationY -= 65536;
        } // two's complement

        let accelerationZ = parseInt(
            dataString.substring(accelerationZStart, accelerationZEnd),
            16
        ); // milli-g
        if (accelerationZ > 32767) {
            accelerationZ -= 65536;
        } // two's complement

        const battery = parseInt(
            dataString.substring(batteryStart, batteryEnd),
            16
        ); // milli-g

        return {
            accelerationX,
            accelerationY,
            accelerationZ,
            battery,
            humidity,
            pressure,
            temperature,
        };
    },
    /**
     * Parse Ruuvi type 5 sensor data
     * @function _parse5
     * @private
     * @param {Object} data sensor data
     * @returns {Object} sensor JSONObject
     */
    _parse5: function (data) {
        const self = this;
        let temperature = (data[3] << 8) | (data[4] & 0xff);
        if (temperature === 32768) {
            // ruuvi spec := 'invalid/not available'
            temperature = undefined;
        } else if (temperature > 32768) {
            // two's complement
            temperature = Number(((temperature - 65536) * 0.005).toFixed(4));
        } else {
            temperature = Number((temperature * 0.005).toFixed(4));
        }

        let humidity = ((data[5] & 0xff) << 8) | (data[6] & 0xff);
        humidity =
            humidity !== 65535
                ? Number((humidity * 0.0025).toFixed(4))
                : undefined;

        let pressure = ((data[7] & 0xff) << 8) | (data[8] & 0xff);
        pressure =
            pressure !== 65535
                ? Number((pressure + 50000).toFixed(4))
                : undefined;

        let accelerationX = (data[9] << 8) | (data[10] & 0xff);
        if (accelerationX === 32768) {
            // ruuvi spec := 'invalid/not available'
            accelerationX = undefined;
        } else if (accelerationX > 32768) {
            // two's complement
            accelerationX = accelerationX - 65536;
        }

        let accelerationY = (data[11] << 8) | (data[12] & 0xff);
        if (accelerationY === 32768) {
            // ruuvi spec := 'invalid/not available'
            accelerationY = undefined;
        } else if (accelerationY > 32768) {
            // two's complement
            accelerationY = accelerationY - 65536;
        }

        let accelerationZ = (data[13] << 8) | (data[14] & 0xff);
        if (accelerationZ === 32768) {
            // ruuvi spec := 'invalid/not available'
            accelerationZ = undefined;
        } else if (accelerationZ > 32768) {
            // two's complement
            accelerationZ = accelerationZ - 65536;
        }

        const powerInfo = ((data[15] & 0xff) << 8) | (data[16] & 0xff);

        let battery = powerInfo >>> 5;
        battery = battery !== 2047 ? battery + 1600 : undefined;

        let txPower = powerInfo & 0b11111;
        txPower = txPower !== 31 ? txPower * 2 - 40 : undefined;

        let movementCounter = data[17] & 0xff;
        movementCounter = movementCounter !== 255 ? movementCounter : undefined;

        let measurementSequenceNumber =
            ((data[18] & 0xff) << 8) | (data[19] & 0xff);
        measurementSequenceNumber =
            measurementSequenceNumber !== 65535
                ? measurementSequenceNumber
                : undefined;

        const mac = [
            self._int2Hex(data[20]),
            self._int2Hex(data[21]),
            self._int2Hex(data[22]),
            self._int2Hex(data[23]),
            self._int2Hex(data[24]),
            self._int2Hex(data[25]),
        ].join(':');

        return {
            accelerationX,
            accelerationY,
            accelerationZ,
            battery,
            humidity,
            mac,
            measurementSequenceNumber,
            movementCounter,
            pressure,
            temperature,
            txPower,
        };
    },
    /**
     * Parse Ruuvi sensor data
     * @param {Object} data sensor data
     * @returns {Object} sensor JSONObject
     */
    _parseData: function (data) {
        const self = this;
        const companyIndex = data.indexOf('FF9904');
        const rData =
            typeof data === 'string'
                ? Buffer.from(
                      self._hexToBytes(
                          data.substring(companyIndex + 2, data.length)
                      )
                  )
                : data;

        const dataFormat = rData[2];

        switch (dataFormat) {
            case 3:
                return self._parse3(rData);
            case 5:
                return self._parse5(rData);
            default:
                throw new Error('Data format not supported');
        }
    },

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
            self.sendSocketNotification('MMM_RUUVI_API_SENSORS_LITE_SENSORS_RESPONSE', {
                data: [],
                identifier: identifier
            });
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
                        data.data.sensors.forEach((sensor) => {
                            const latestMeasurement = sensor.measurements[0];
                            const hexData = latestMeasurement.data;
                            const parsed = self._parseData(hexData);

                            const time = new Date(latestMeasurement.timestamp);

                            const s = {
                                name: sensor.name,
                                time: moment(time * 1000).format(
                                    'DD.MM.YYYY HH:mm'
                                ),
                                humidity: parsed.humidity,
                                pressure: parsed.pressure,
                                temperature: parsed.temperature,
                                battery: parsed.battery,
                                isTodayMeasurement: moment(time * 1000).isSame(moment(), 'day')
                            };
                            sensors.push(s);
                        });
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