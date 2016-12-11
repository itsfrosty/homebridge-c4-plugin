# homebridge-c4-plugin

This plugin for homebridge allows you to control your control4 devices using
Siri/Homekit on iOS. This plugin is very early state and right now only supports
lights/dimmers.

This does two-way sync so any changes made using switches or control4 app will
be reflected in Homekit in few seconds.

How To:
--------
The documentation is not that easy to follow right now :(. Will improve it in
future revs.
- Install homebridge - https://github.com/nfarina/homebridge
- Install Web2Way driver in Control4 - https://github.com/itsfrosty/control4-2way-web-driver
- Install this plugin - "sudo npm install -g homebridge-c4-plugin"
- Find the proxy_id & variable_ids for each of your devices and include them
in your homebridge config.json.


Sample Homebridge Config:
--------------------------
~~~~
"accessories": [
  {
   "accessory": "c4",
    "name": "Bedroom Lights",
    "device_type": "light",
    "proxy_id": "25",
    "level_variable_id": "1001",
    "state_variable_id": "1000",
    "base_url": "http://192.168.1.142:9000",
    "has_level": "yes",
    "has_state": "yes",
    "refresh_interval": 2000
  }
]
~~~~
