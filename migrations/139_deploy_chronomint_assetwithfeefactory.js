const ChronoBankAssetWithFeeFactory = artifacts.require("./ChronoBankAssetWithFeeFactory.sol");

module.exports = function (deployer, network) {
    deployer.deploy(ChronoBankAssetWithFeeFactory)
}
