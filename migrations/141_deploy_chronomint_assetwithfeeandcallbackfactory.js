const ChronoBankAssetWithFeeAndCallbackFactory = artifacts.require("./ChronoBankAssetWithFeeAndCallbackFactory.sol");

module.exports = function (deployer, network) {
    deployer.deploy(ChronoBankAssetWithFeeAndCallbackFactory)
}
