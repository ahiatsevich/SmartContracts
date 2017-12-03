var ExchangeManager = artifacts.require("./ExchangeManager.sol");
var ExchangeBackend = artifacts.require("./ExchangeBackend.sol")
const Storage = artifacts.require('./Storage.sol');

module.exports = function(deployer, network) {
    deployer.deploy(ExchangeManager, Storage.address, 'ExchangeManager')
    .then(() => deployer.deploy(ExchangeBackend))
      .then(() => console.log("[MIGRATION] [140] ExchangeManager: #done"))
}
