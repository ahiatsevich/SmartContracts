var AssetOwnershipDelegateResolver = artifacts.require('./AssetOwnershipDelegateResolver.sol')

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(AssetOwnershipDelegateResolver))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Assets Ownership Resolver redeploy: #done"))
}
