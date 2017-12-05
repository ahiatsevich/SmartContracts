const StringsLib = artifacts.require('./StringsLib.sol')
const AssetsManagerAggregations = artifacts.require('./AssetsManagerAggregations.sol')

// already unnecessary
module.exports = function(deployer, network, accounts) {
    deployer
    .then(() => deployer.deploy(StringsLib))
    .then(() => deployer.deploy(AssetsManagerAggregations))
}
