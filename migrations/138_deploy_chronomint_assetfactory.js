const ChronoBankAssetFactory = artifacts.require("./ChronoBankAssetFactory.sol");

module.exports = function (deployer, network) {
    deployer.deploy(ChronoBankAssetFactory)
}
