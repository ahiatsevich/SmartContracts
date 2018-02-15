var PendingManager = artifacts.require("./PendingManager.sol");
const Storage = artifacts.require("./Storage.sol");

module.exports = async function(deployer, network) {
    deployer.then(async () => {
        await deployer.deploy(PendingManager, Storage.address, 'PendingManager')

        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PendingManager deploy: #done")
    })
}
