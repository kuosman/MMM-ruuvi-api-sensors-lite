# Module for [MagicMirror](https://magicmirror.builders/): Ruuvi api sensors lite

The `MMM-ruuvi-api-sensors-lite` module fetches Ruuvi sensors data from User API (https://docs.ruuvi.com/communication/cloud/user-api) and show sensor name and temperature value.


## Screenshot

![Ruuvi api sensors lite screenshot, col style](screenshot.png)

## Using the module

1) Clone this repository under `MagicMirror/modules` folder
2) Run `npm install` in `MagicMirror/modules/MMM-ruuvi-api-sensors-lite` folder
3) Add to the modules array in the `MagicMirror/config/config.js` file:
````javascript
modules: [{
	module: "MMM-ruuvi-api-sensors-lite",
	position: "top_right",
	header: "Ruuvi measurements",
	config: {
        batteryEmptyIcon: 'battery-half',
        updateInterval: 5 * 1000 * 60, // every 5 minutes
        apiUrl: 'https://network.ruuvi.com',
        token: '<TOKEN>',
        negativeColor: '#4800FF',
        highlightNegative: true
	}
}]
````

## Configuration options

The following properties can be configured:


| Option                       	| Default value               | Description
| -----------------------------	| --------------------------- | -----------
| `batteryEmptyIcon`			| `battery-half`              | Battery empty icon. See others: https://fontawesome.com/icons?d=gallery
| `updateInterval`				| `30000`                     | Update interval in milliseconds. Limited minumum value for 1 minute because API blocks faster updates.
| `apiUrl`						| `https://network.ruuvi.com` | Api url
| `token`                       |                             | **Necessary** own token, get it: <br>- Register user or reset token: Send POST message with following body ```{"email": "your@email.com"}``` to `https://network.ruuvi.com/register`<br>- Verify account: Send GET message with `token` parameter to `https://network.ruuvi.com/verify?token=<TOKEN IN YOUR EMAIL>`<br>- When verified account you get response JSON where your acces token is<br><br>read more: https://docs.ruuvi.com/communication/cloud/user-api
| `negativeColor`               | `#4800FF`                   | Highlight negative value this color
| `highlightNegative`           | `true`                      | Higlight negative measurements true/false
| `hideNotTodayMeasurement`     | `false`                     | Hide not today measurement  true/false
