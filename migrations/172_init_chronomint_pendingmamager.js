const PendingManager = artifacts.require("./PendingManager.sol");
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = async (deployer, network) => {
    deployer.then(async () => {
        let _storageManager = await StorageManager.deployed()
        await _storageManager.giveAccess(PendingManager.address, "PendingManager")

        let _pendingManager = await PendingManager.deployed()
        await _pendingManager.init(ContractsManager.address)

        let _history = await MultiEventsHistory.deployed()
        await _history.authorize(PendingManager.address)

        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PendingManager init: #done")
    })
}
