const { parseGatewayResponse } = require('../ruuviGatewayParser');

describe('Ruuvi parse', () => {
    test('Parse gateway response', () => {
        const json = {
            result: 'success',
            data: {
                sensors: [
                    {
                        sensor: 'a',
                        name: 'A',
                        picture:
                            'https://prod-sensor-profile-pictures.s3.eu-central-1.amazonaws.com/4f0b3f7a-77a8-4f46-a3af-40acf14ff598.jpg',
                        measurements: [
                            {
                                coordinates: 'N/A',
                                data: '0201061BFF99040504D49C40C37DFF0C03C4000CA3F668BF49C1819DF99A28',
                                gwmac: 'E6:EB:C0:16:44:06',
                                timestamp: 1766233464,
                                rssi: -68,
                            },
                        ],
                    },
                    {
                        sensor: 'b',
                        name: 'RuuviAir',
                        picture:
                            'https://prod-sensor-profile-pictures.s3.eu-central-1.amazonaws.com/7b6c03d7-8ff2-42a2-a96f-2527fb3457bb.jpg',
                        measurements: [
                            {
                                coordinates: 'N/A',
                                data: '2BFF9904E1118A3E34C3C500150021002B003002CD2500FFFFFFFFFFFF151E79B8FFFFFFFFFFCE5C8DB50AD0030398FC',
                                gwmac: 'E6:EB:C0:16:44:06',
                                timestamp: 1766233471,
                                rssi: -34,
                            },
                        ],
                    },
                    {
                        sensor: 'c',
                        name: 'C',
                        picture:
                            'https://prod-sensor-profile-pictures.s3.eu-central-1.amazonaws.com/7226793c-b03e-4c6c-9e24-d156fe1c7f61.jpg',
                        measurements: [
                            {
                                coordinates: 'N/A',
                                data: '0201061BFF9904050EF44925C3D003A4FE080000B436A34F63CEE88E4CEA23',
                                gwmac: 'E6:EB:C0:16:44:06',
                                timestamp: 1766233471,
                                rssi: -81,
                            },
                        ],
                    },
                    {
                        sensor: 'd',
                        name: 'D',
                        picture:
                            'https://prod-sensor-profile-pictures.s3.eu-central-1.amazonaws.com/abf07185-debe-4af0-94c4-661e0b0da47b.jpg',
                        measurements: [
                            {
                                coordinates: 'N/A',
                                data: '0201061BFF9904050F794E26C3DE03F000F0001C99760D5303CF3472FC8BFB',
                                gwmac: 'E6:EB:C0:16:44:06',
                                timestamp: 1766233471,
                                rssi: -63,
                            },
                        ],
                    },
                ],
            },
        };
        const sensors = parseGatewayResponse(json);
        console.log(sensors);

        expect(sensors).toBeDefined();
        expect(sensors.length).toBe(json.data.sensors.length);
        expect(sensors[0].isRuuviAir).toBe(false);
        expect(sensors[1].isRuuviAir).toBe(true);
        expect(sensors[2].temperature).toBe(19.14);
        expect(sensors[3].humidity).toBe(50.015);
    });

    test('Parse  not valid gateway response', () => {
        const json = {};
        const sensors = parseGatewayResponse(json);
        console.log(sensors);

        expect(sensors).toBeDefined();
        expect(sensors.length).toBe(0);
    });
});
