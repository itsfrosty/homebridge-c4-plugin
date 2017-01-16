var Characteristic = require("hap-nodejs").Characteristic;


function fahrenheitToCelsius(temperature) {
  return (temperature - 32) / 1.8
}

function celsiusToFahrenheit(temperature) {
  return (temperature * 1.8) + 32
}

module.exports = {
  "unit": {
    "characteristic" : Characteristic.TemperatureDisplayUnits,
    "readOnly": true,
    fromConverter: function(value) {
      if (value === "FAHRENHEIT") {
        return Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      } else {
        return Characteristic.TemperatureDisplayUnits.CELSIUS;
      }
    },
    toConverter: function(value) {
      return value;
    }
  },
  "current_state": {
    "characteristic" : Characteristic.CurrentHeatingCoolingState,
    "readOnly": true,
    fromConverter: function(value) {
      switch (value) {
        case "Heat":
          return Characteristic.CurrentHeatingCoolingState.HEAT;
        case "Cool":
          return Characteristic.CurrentHeatingCoolingState.COOL;
        default:
          return Characteristic.CurrentHeatingCoolingState.OFF;
      }
    },
    toConverter: function(value) {
      return value;
    }
  },
  "target_state": {
    "characteristic" : Characteristic.TargetHeatingCoolingState,
    fromConverter: function(value) {
      switch (value) {
        case "Heat":
          return Characteristic.TargetHeatingCoolingState.HEAT;
        case "Cool":
          return Characteristic.TargetHeatingCoolingState.COOL;
        case "Auto":
          return Characteristic.TargetHeatingCoolingState.AUTO;
        default:
          return Characteristic.TargetHeatingCoolingState.OFF;
      }
    },
    toConverter: function(value) {
      switch (value) {
        case Characteristic.TargetHeatingCoolingState.HEAT:
          return "Heat";
        case Characteristic.TargetHeatingCoolingState.COOL:
          return "Cool";
        case Characteristic.TargetHeatingCoolingState.AUTO:
          return "Auto";
        default:
          return "Off";
      }
    }
  },
  "current_temperature": {
    "characteristic" : Characteristic.CurrentTemperature,
    "readOnly": true,
    "props": {
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.CELSIUS,
      minStep: 0.5,
      minValue: 0,
      maxValue: 100
    },
    fromConverter: function(value) {
      return fahrenheitToCelsius(parseInt(value));
    },
    toConverter: function(value) {
      return Math.round(celsiusToFahrenheit(value));
    }
  },
  "heatpoint": {
    "characteristic" : Characteristic.HeatingThresholdTemperature,
    "props": {
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.CELSIUS,
      minStep: 0.5,
      minValue: 15,
      maxValue: 30
    },
    fromConverter: function(value) {
      return fahrenheitToCelsius(parseInt(value));
    },
    toConverter: function(value) {
      return Math.round(celsiusToFahrenheit(value));
    }
  },
  "coolpoint": {
    "characteristic" : Characteristic.CoolingThresholdTemperature,
    "props": {
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.CELSIUS,
      minStep: 0.5,
      minValue: 15,
      maxValue: 30
    },
    fromConverter: function(value) {
      return fahrenheitToCelsius(parseInt(value));
    },
    toConverter: function(value) {
      return Math.round(celsiusToFahrenheit(value));
    }
  },
  "target_temperature": {
    "characteristic" : Characteristic.TargetTemperature,
    "derived": true,
    "props": {
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.CELSIUS,
      minStep: 0.5,
      minValue: 15,
      maxValue: 30
    },
    fromConverter: function(value, result) {
      if (!result) {
        console.log('from converted undefined result')
        return;
      }
      var targetTemperature = null;
      var high = result["coolpoint"];
      var low = result["heatpoint"];
      var current = result["current_temperature"];
      switch (result.target_state) {
        case Characteristic.TargetHeatingCoolingState.HEAT:
          targetTemperature = low;
          break;
        case Characteristic.TargetHeatingCoolingState.COOL:
          targetTemperature = high;
          break;
        case Characteristic.TargetHeatingCoolingState.AUTO:
        case Characteristic.TargetHeatingCoolingState.OFF:
          if (current <= low) {
            targetTemperature = low;
          } else if (current >= high) {
            targetTemperature = high;
          } else {
            // set to nearest
            targetTemperature =  Math.abs(high - current) < Math.abs(current - low) ? high : low;
          }
          break;
      }
      if (!targetTemperature) {
        return;
      }
      return targetTemperature;
    },
    toConverter: function(value) {
      return Math.round(celsiusToFahrenheit(value));
    },
    getVariableIDForSet: function(value, result, variableIDs) {
      var targetTemperature = null;
      var high = result["coolpoint"];
      var low = result["heatpoint"];
      var current = result["current_temperature"];
      switch (result.target_state) {
        case Characteristic.TargetHeatingCoolingState.HEAT:
          return variableIDs["heatpoint"];
        case Characteristic.TargetHeatingCoolingState.COOL:
          return variableIDs["coolpoint"];
        case Characteristic.TargetHeatingCoolingState.AUTO:
        case Characteristic.TargetHeatingCoolingState.OFF:
          if (Math.abs(high - current) < Math.abs(current - low)) {
            return variableIDs["coolpoint"];
          } else {
            return variableIDs["heatpoint"];
          }
      }
    }
  }
};
