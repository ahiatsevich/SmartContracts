var PlatformTokenExtensionGatewayManager = artifacts.require("./PlatformTokenExtensionGatewayManager.sol")

module.exports = function(deployer, network) {
    deployer
    .then(() => deployer.deploy(PlatformTokenExtensionGatewayManager))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Platform Token Extension Gateway Manager deploy: #done"))
}
