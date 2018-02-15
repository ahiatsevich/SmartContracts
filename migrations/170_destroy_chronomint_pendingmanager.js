const PendingManager = artifacts.require("./PendingManager.sol");
const StorageManager = artifacts.require('./StorageManager.sol');
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = async (deployer, network, accounts) => {
    deployer.then(async () => {
        let storageManager = await StorageManager.deployed()
        await storageManager.blockAccess(PendingManager.address, "PendingManager")

        let history = await MultiEventsHistory.deployed()
        await history.reject(PendingManager.address)

        let contractsManager = await ContractsManager.deployed();
        await contractsManager.removeContract(PendingManager.address);

        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PendingManager destroy: #done")
    })
}
