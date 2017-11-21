const TokenFactory = artifacts.require("./TokenFactory.sol");
const AssetsManager = artifacts.require("./AssetsManager.sol");
const ChronoBankAssetFactory = artifacts.require("./ChronoBankAssetFactory.sol");
const ChronoBankAssetWithFeeFactory = artifacts.require("./ChronoBankAssetWithFeeFactory.sol");
const ChronoBankAssetWithCallbackFactory = artifacts.require("./ChronoBankAssetWithCallbackFactory.sol");
const ChronoBankAssetWithFeeAndCallbackFactory = artifacts.require("./ChronoBankAssetWithFeeAndCallbackFactory.sol");

module.exports = async (deployer, network) => {
    deployer.then(async () => {
        let tokenFactory = await TokenFactory.deployed();

        await tokenFactory.setAssetFactory("ChronoBankAsset", ChronoBankAssetFactory.address);
        await tokenFactory.setAssetFactory("ChronoBankAssetWithFee", ChronoBankAssetWithFeeFactory.address);
        await tokenFactory.setAssetFactory("ChronoBankAssetWithCallback", ChronoBankAssetWithCallbackFactory.address);
        await tokenFactory.setAssetFactory("ChronoBankAssetWithFeeAndCallback", ChronoBankAssetWithFeeAndCallbackFactory.address);

        let assetsManager = await AssetsManager.deployed();
        assetsManager.setTokenFactory(tokenFactory.address);

        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] TokenFactory setup: #done");
    });
}
