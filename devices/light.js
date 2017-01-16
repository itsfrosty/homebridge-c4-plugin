var Characteristic = require("hap-nodejs").Characteristic;

module.exports = {
  "state": {
    "characteristic" : Characteristic.On,
    "readOnly": false,
    fromConverter: function(value) {
      return value > 0 ;
    },
    toConverter: function(value) {
      return value ? 1 : 0;
    }
  },
  "level": {
    "characteristic" : Characteristic.Brightness,
    "readOnly": false,
    fromConverter: function(value) {
      return parseInt(value);
    },
    toConverter: function(value) {
      return value;
    }
  }
};
