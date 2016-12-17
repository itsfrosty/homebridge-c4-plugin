var request = require("request");
var pollingtoevent = require('polling-to-event');
var url = require('url');

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerAccessory("homebridge-c4-plugin", "c4", c4Accessory);
}

function c4Accessory(log, config, api) {
  log("C4Plugin Init");
  this.log = log;
  this.deviceType = config["device_type"] || "switch";
  this.proxyID = config["proxy_id"];
  this.baseURL = config["base_url"];

  this.levelVariableID = config["level_variable_id"];
  this.hasLevel = config["has_level"] || "no";

  this.stateVariableID = config["state_variable_id"];
  this.hasState = config["has_state"] || "yes";


  this.refreshInterval = config["refresh_interval"] || 5000;

  if (this.refreshInterval > 0 && this.hasState === "yes") {
    var statePoll = pollingtoevent(
      this.getState.bind(this),
      { interval: this.refreshInterval }
    );
    statePoll.on("poll", function(value) {
      this.skipUpdate = true;
      switch(this.deviceType) {
        case "light":
          if (this.service) {
            this.service.getCharacteristic(Characteristic.On)
              .setValue(value);
          }
          break;
      }
      this.skipUpdate = false;
    }.bind(this));
    statePoll.on("error", function(error) {
      this.log.error(error.message);
    }.bind(this));
  }
  if (this.refreshInterval > 0 && this.hasLevel === "yes") {
    var levelPoll = pollingtoevent(
      this.getLevel.bind(this),
      { interval: this.refreshInterval }
    );
    levelPoll.on("poll", function(value) {
      this.skipUpdate = true;
      switch(this.deviceType) {
        case "light":
          if (this.service) {
            this.service.getCharacteristic(Characteristic.Brightness)
    				  .setValue(value);
          }
          break;
      }
      this.skipUpdate = false;
    }.bind(this));
    levelPoll.on("error", function(error) {
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
  var informationService = new Service.AccessoryInformation();
  informationService
    .setCharacteristic(Characteristic.Manufacturer, "Control4")
    .setCharacteristic(Characteristic.Model, "Control4")
    .setCharacteristic(Characteristic.SerialNumber, "213141");

  switch (this.deviceType) {
    case "light":
      this.service = new Service.Lightbulb(this.name);
      this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this.getState.bind(this))
        .on('set', this.setState.bind(this));

      if (this.hasLevel == "yes") {
        this.service
          .addCharacteristic(new Characteristic.Brightness())
          .on('get', this.getLevel.bind(this))
          .on('set', this.setLevel.bind(this));
      }
      return [informationService, this.service];
  }
};

c4Accessory.prototype.getLevel = function(callback) {
  if (this.hasLevel !== 'yes') {
    this.log.warn("Ignoring request - This device doesn't support level.");
    callback(new Error("This device doesn't support level."));
    return;
  }
  getDeviceVariables(
    this.baseURL,
    this.proxyID,
    [this.levelVariableID],
    function(error, response) {
      if (error) {
        this.log.error("Get level function failed: " + error.message);
        callback(error);
      } else {
        var level = parseInt(response[this.levelVariableID]);
        this.log.debug("Level: " + level);
        callback(null, level);
      }
    }.bind(this)
  );
};

c4Accessory.prototype.setLevel = function(level, callback) {
  if (this.skipUpdate) {
    callback();
    return;
  }
  setDeviceVariables(
    this.baseURL,
    this.proxyID,
    [this.levelVariableID],
    level,
    function(error, response) {
      if (error) {
        this.log.error("Set level function failed: " + error.message);
        callback(error);
      } else if (response.success == "true") {
        callback(null);
      } else {
        this.log.error("Unable to set level");
        callback(new Error("Unable to set level"));
      }
    }.bind(this)
  );
};

c4Accessory.prototype.getState = function(callback) {
  if (this.hasState !== 'yes') {
    this.log.warn("Ignoring request - This device doesn't support state.");
    callback(new Error("This device doesn't support state."));
    return;
  }
  getDeviceVariables(
    this.baseURL,
    this.proxyID,
    [this.stateVariableID],
    function(error, response) {
      if (error) {
        this.log.error("Get state function failed: " + error.message);
        callback(error);
      } else {
        var state = response[this.stateVariableID] > 0 ;
        this.log.debug("State: " + state);
        callback(null, state);
      }
    }.bind(this)
  );
};

c4Accessory.prototype.setState = function(newState, callback) {
  if (this.skipUpdate) {
    callback();
    return;
  }
  setDeviceVariables(
    this.baseURL,
    this.proxyID,
    [this.stateVariableID],
    newState ? 1 : 0,
    function(error, response) {
      if (error) {
        this.log.error("Get state function failed: " + error.message);
        callback(error);
      } else if (response.success == "true") {
        callback(null);
      } else {
        this.log.error("Unable to set brightness");
        callback(new Error("Unable to set brightness"));
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

function setDeviceVariables(baseURL, proxyID, variableID, newValue, callback) {
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
