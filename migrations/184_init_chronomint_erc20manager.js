var ERC20Manager = artifacts.require("./ERC20Manager.sol");
const Storage = artifacts.require('./Storage.sol');
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = async (deployer, network) => {
    deployer.then(async () => {
        let storageManager = await StorageManager.deployed();
        await storageManager.giveAccess(ERC20Manager.address, 'ERC20Manager');

        let manager = await ERC20Manager.deployed();
        await manager.init(ContractsManager.address);

        let events = await MultiEventsHistory.deployed();
        await events.authorize(manager.address);

        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ERC20Manager setup: #done")
    });
}
