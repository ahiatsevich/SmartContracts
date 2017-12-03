var ExchangeManager = artifacts.require("./ExchangeManager.sol");
var ExchangeFactory = artifacts.require("./ExchangeFactory.sol");
var ExchangeBackend = artifacts.require("./ExchangeBackend.sol");
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = function(deployer, network) {
    deployer
      .then(() => StorageManager.deployed())
      .then(_storageManager => _storageManager.giveAccess(ExchangeManager.address, 'ExchangeManager'))
      .then(() => ExchangeManager.deployed())
      .then(_manager => manager = _manager)
      .then(() => manager.init(ContractsManager.address, ExchangeBackend.address, ExchangeFactory.address))
      .then(() => MultiEventsHistory.deployed())
      .then(_history => _history.authorize(manager.address))
      .then(() => console.log("[MIGRATION] [141] ExchangeManager: #done"))
}
