var request = require("request");
var pollingtoevent = require('polling-to-event');
var url = require('url');
var Service = require("hap-nodejs").Service;
var light = require('./devices/light');
var thermostat = require('./devices/thermostat');

var allDeviceConfig = {
  "light" : light,
  "thermostat": thermostat
};

var Service;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  homebridge.registerAccessory("homebridge-c4-plugin", "c4", c4Accessory);
}

function c4Accessory(log, config) {
  log("C4Plugin Init");
  this.log = log;
  this.deviceType = config["device_type"] || "light";
  this.proxyID = config["proxy_id"];
  this.baseURL = config["base_url"];
  this.variableIDs = config["variable_ids"];
  this.deviceConfig = allDeviceConfig[this.deviceType];
  this.name = config["name"];

  this.refreshInterval = config["refresh_interval"] || 5000;
  this.computeService();

  if (this.refreshInterval > 0) {
    var statePoll = pollingtoevent(
      this.getState.bind(this),
      { interval: this.refreshInterval }
    );
    statePoll.on("poll", function(result) {
      if (!this.service) {
        return;
      }
      if (!result) {
        this.log.error("error fetching values");
      }

      this.skipUpdate = true;
      for (var variableName in this.deviceConfig) {
        if (!this.deviceConfig.hasOwnProperty(variableName)) {
            continue;
        }
        this.service.getCharacteristic(this.deviceConfig[variableName].characteristic)
          .setValue(result[variableName]);
      }
      this.skipUpdate = false;
    }.bind(this));
    statePoll.on("error", function(error) {
      this.log.error(error.message);
    }.bind(this));
  }
}

c4Accessory.prototype = {};

c4Accessory.prototype.identify = function(callback) {
  this.log.debug("Identify requested!");
  callback(); // success
};

c4Accessory.prototype.getServices = function() {
  return [this.service];
}


c4Accessory.prototype.computeService = function() {
  switch (this.deviceType) {
    case "light":
      this.service = new Service.Lightbulb(this.name);
      break;
    case "thermostat":
      this.service = new Service.Thermostat(this.name);
      break;
  }
  for (var variableName in this.deviceConfig) {
    if (!this.deviceConfig.hasOwnProperty(variableName)) {
      continue;
    }
    var characteristic = this.service.getCharacteristic(
      this.deviceConfig[variableName].characteristic
    );
    characteristic.on('get', this.getStateVariable.bind(this, variableName));
    if (!this.deviceConfig[variableName].readOnly) {
      characteristic.on('set', this.setStateVariable.bind(this, variableName));
    }
    if (this.deviceConfig[variableName].props) {
      characteristic.setProps(this.deviceConfig[variableName].props);
    }
  }
};

c4Accessory.prototype.getState = function(callback, useCached) {
  if (useCached && this._lastResult) {
    callback(null, this._lastResult);
    return;
  }
  var variablesToFetch = [];
  for (var variableName in this.deviceConfig) {
    if (!this.deviceConfig.hasOwnProperty(variableName)) {
      continue;
    }
    if (
      this.variableIDs[variableName] &&
      variablesToFetch.indexOf(this.variableIDs[variableName]) === -1
    ) {
      variablesToFetch.push(this.variableIDs[variableName]);
    }
  }

  getDeviceVariables(
    this.baseURL,
    this.proxyID,
    variablesToFetch,
    function(error, response) {
      if (error) {
        this.log.error("Get state function failed: " + error.message);
        callback(error);
        return;
      }
      var result = {};
      for (var variableName in this.deviceConfig) {
        if (!this.deviceConfig.hasOwnProperty(variableName)) {
          continue;
        }
        if (this.deviceConfig[variableName].derived) {
          // compute the derived in second iteration
          continue;
        }
        result[variableName] = this.deviceConfig[variableName].fromConverter(
          response[this.variableIDs[variableName]]
        );
      }
      for (var variableName in this.deviceConfig) {
        if (!this.deviceConfig.hasOwnProperty(variableName)) {
          continue;
        }
        if (!this.deviceConfig[variableName].derived) {
          // skip non-derived since already computed them
          continue;
        }
        result[variableName] = this.deviceConfig[variableName].fromConverter(
          response[this.variableIDs[variableName]],
          result
        );
      }
      this._lastResult = result;
      callback(null, result);
    }.bind(this)
  );
};

c4Accessory.prototype.getStateVariable = function(variableName, callback) {
  this.getState(function(error, result) {
    callback(error, result[variableName]);
  }.bind(this), true);
};

c4Accessory.prototype.setStateVariable = function(variableName, value, callback) {
  if (this.skipUpdate) {
    callback();
    return;
  }
  var variableID = this.variableIDs[variableName];
  if (this.deviceConfig[variableName].derived) {
    variableID = this.deviceConfig[variableName].getVariableIDForSet(
      value,
      this._lastResult,
      this.variableIDs
    );
  }
  setDeviceVariable(
    this.baseURL,
    this.proxyID,
    variableID,
    this.deviceConfig[variableName].toConverter(value),
    function(error, response) {
      if (error) {
        this.log.error("Set variable function failed: " + error.message);
        callback(error);
      } else if (response.success == "true") {
        callback(null);
      } else {
        this.log.error("Unable to set variable");
        callback(new Error("Unable to set variable"));
      }
    }.bind(this)
  );
};

function getDeviceVariables(baseURL, proxyID, variableIDs, callback) {
  var deviceURL = url.parse(baseURL);
  deviceURL.query = {
    command: "get",
    proxyID: proxyID,
    variableID: variableIDs.join(",")
  };

  request({
    url: deviceURL.format(deviceURL),
    body: "",
    method: "GET",
    json:true
  },
  function(error, response, body) {
    callback(error, response && response.toJSON().body)
  })
};

function setDeviceVariable(baseURL, proxyID, variableID, newValue, callback) {
  var deviceURL = url.parse(baseURL);
  deviceURL.query = {
    command: "set",
    proxyID: proxyID,
    variableID: variableID,
    newValue: newValue
  };

  request({
    url: deviceURL.format(deviceURL),
    body: "",
    method: "GET",
    json:true
  },
  function(error, response, body) {
    callback(error, response && response.toJSON().body)
  })
};
