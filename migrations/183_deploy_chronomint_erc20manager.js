var ERC20Manager = artifacts.require("./ERC20Manager.sol");
const Storage = artifacts.require('./Storage.sol');
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = function(deployer, network) {
    deployer.deploy(ERC20Manager, Storage.address, "ERC20Manager")
      .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ERC20Manager deploy: #done"))
}
