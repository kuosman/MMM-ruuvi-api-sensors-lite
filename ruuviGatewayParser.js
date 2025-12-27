'use strict';
var moment = require('moment');

function parseGatewayResponse(apiResponse) {
    if (!apiResponse || !apiResponse.data || !apiResponse.data.sensors)
        return [];
    return apiResponse.data.sensors
        .map((sensor) => {
            if (!sensor.measurements || sensor.measurements.length === 0)
                return null;

            const m = sensor.measurements[0];
            const hex = m.data;

            let parsed;
            try {
                parsed = parseRuuvi(hex);
            } catch (err) {
                parsed = { error: err.message };
            }

            // If Air, calculate IAQ
            if (parsed && isRuuviAir(parsed)) {
                parsed.iaq = calculateIAQ(parsed);
                parsed.iaqLevel = iaqScoreToLevel(parsed.iaq);
            }

            const time = new Date(m.timestamp);

            return {
                sensor: sensor.sensor,
                name: sensor.name,
                rssi: m.rssi,
                timestamp: m.timestamp,
                timestampString: moment(time * 1000).format(
                    'DD.MM.YYYY HH:mm'
                ),
                isTodayMeasurement: moment(time * 1000).isSame(moment(), 'day'),
                isRuuviAir: isRuuviAir(parsed),
                ...parsed,
            };
        })
        .filter((s) => s !== null);
}


/* =========================
   BLE → Manufacturer Data
========================= */
function hexToBuffer(hex) {
    return Buffer.from(hex, 'hex');
}

function findRuuviMSD(buf) {
    let i = 0;
    while (i < buf.length) {
        const len = buf[i];
        if (len === 0) break;

        const type = buf[i + 1];

        if (type === 0xff) {
            const companyId = buf.readUInt16LE(i + 2);
            if (companyId === 0x0499) {
                return buf.slice(i + 4, i + 1 + len);
            }
        }
        i += len + 1;
    }
    return null;
}

/* =========================
   Universal parser
========================= */
function parseRuuvi(hex) {
    const buf = hexToBuffer(hex);
    const msd = findRuuviMSD(buf);

    if (!msd) {
        throw new Error('Ruuvi MSD not found');
    }

    const df = msd[0];
    let parsed;

    if (df === 0x03) parsed = parseDF3(msd);
    else if (df === 0x05) parsed = parseDF5(msd);
    else if (df === 0xe1) {
        // Tarkista MAC
        const mac = msd.slice(19, 25);
        if (mac.every((b) => b === 0xff)) {
            // Todennäköisesti Ruuvi Air gateway-paketti → käytä DF5 Air parseria
            parsed = parseDF5(msd);
        } else {
            // Oikea Pro RAW
            parsed = parseRuuviPro(msd);
        }
    } else {
        throw new Error('Unsupported Ruuvi Data Format: ' + df);
    }

    return parsed;
}

/* =========================
   Ruuvi Air identifieding
========================= */
function isRuuviAir(parsed) {
    return !!(parsed && (parsed.voc || parsed.nox));
}

/* =========================
   IAQ-calculation
========================= */
function calculateIAQ({ voc, nox }) {
    if (voc == null && nox == null) return null;

    // Normalize VOC 0–1
    let vNorm = Math.log10(voc + 1) / 4; // Jakaja 4 → korkea IAQ isoille VOC-arvoille
    if (vNorm > 1) vNorm = 1;

    // NOx
    const nNorm = nox != null ? Math.min(nox / 100, 1) : 0;

    // Badness: 0 = hyvä, 1 = huono
    const badness = 0.85 * Math.pow(1 - vNorm, 1) + 0.15 * Math.pow(nNorm, 1.8);

    // IAQ iso = hyvä
    return Math.round(100 * (1 - badness));
}

function iaqScoreToLevel(iaq) {
    if (iaq == null) return null;
    if (iaq >= 80) return 5; // Excellent / Good
    if (iaq >= 60) return 4;
    if (iaq >= 40) return 3;
    if (iaq >= 20) return 2;
    return 1; // Very Poor
}





/* =========================
   DF3 (old Tag)
========================= */
function parseDF3(b) {
    return {
        deviceType: 'RuuviTag (DF3)',
        temperature: b.readInt8(2) + b.readUInt8(3) / 100,
        humidity: b.readUInt8(1) * 0.5,
        pressure: b.readUInt16BE(4) + 50000,
        acceleration: {
            x: b.readInt16BE(6) / 1000,
            y: b.readInt16BE(8) / 1000,
            z: b.readInt16BE(10) / 1000,
        },
        batteryVoltage: b.readUInt16BE(12),
        voc: null,
        co2: null,
        nox: null,
    };
}

/* =========================
   DF5 (Air / Tag)
========================= */
function parseDF5(b) {
    const temperature = b.readInt16BE(1) / 200;
    const humidity = b.readUInt16BE(3) / 400;
    const pressure = b.readUInt16BE(5) + 50000;

    const acceleration = {
        x: b.readInt16BE(7) / 1000,
        y: b.readInt16BE(9) / 1000,
        z: b.readInt16BE(11) / 1000,
    };

    const powerInfo = b.readUInt16BE(13);
    const batteryVoltage = (powerInfo >> 5) + 1600;
    const txPower = (powerInfo & 0x1f) * 2 - 40;

    const movementCounter = b.readUInt8(15);
    const measurementSequence = b.readUInt16BE(16);

    const mac = formatMac(b.slice(18, 24));

    let vocIndex = null;
    let eco2 = null;
    const isAir = b.length >= 28;

    if (isAir) {
        vocIndex = b.readUInt16BE(24);
        eco2 = b.readUInt16BE(26);
    }

    return {
        deviceType: isAir ? 'Ruuvi Air' : 'RuuviTag',
        mac,
        temperature,
        humidity,
        pressure,
        batteryVoltage,
        txPower,
        movementCounter,
        measurementSequence,
        acceleration,
        voc: vocIndex,
        co2: eco2,
        nox: null,
    };
}

/* =========================
   Ruuvi Pro RAW v2
========================= */
function parseRuuviPro(b) {
    const readInt16 = (o) => b.readInt16BE(o);
    const readUInt16 = (o) => b.readUInt16BE(o);

    return {
        deviceType: 'Ruuvi Pro',
        temperature: readInt16(1) / 100,
        humidity: readUInt16(3) / 100,
        pressure: readUInt16(5) + 50000,
        co2: readUInt16(7),
        voc: readUInt16(9),
        nox: readUInt16(11),
        illuminance: readUInt16(13),
        sound: readUInt16(15) / 100,
        batteryVoltage: readUInt16(17) / 1000,
        mac: formatMac(b.slice(19, 25)),
    };
}

/* =========================
   Helpers
========================= */
function formatMac(buf) {
    return [...buf]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
}

module.exports = { parseGatewayResponse };
