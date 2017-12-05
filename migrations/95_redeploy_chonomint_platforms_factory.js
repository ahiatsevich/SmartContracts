var ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol');
const AssetOwnershipDelegateResolver = artifacts.require('./AssetOwnershipDelegateResolver.sol')

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(ChronoBankPlatformFactory, AssetOwnershipDelegateResolver.address))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ChronoBank Platform Factory deploy: #done"))
}
