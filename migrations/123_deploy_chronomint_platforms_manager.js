var PlatformsManager = artifacts.require("./PlatformsManager.sol")
const Storage = artifacts.require("./Storage.sol")

module.exports = function(deployer, network) {
    deployer
    .then(() => deployer.deploy(PlatformsManager, Storage.address, "PlatformsManager"))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PlatformsManager deploy: #done"))
}
