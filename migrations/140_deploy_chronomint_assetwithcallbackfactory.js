const ChronoBankAssetWithCallbackFactory = artifacts.require("./ChronoBankAssetWithCallbackFactory.sol");

module.exports = function (deployer, network) {
    deployer.deploy(ChronoBankAssetWithCallbackFactory)
}
