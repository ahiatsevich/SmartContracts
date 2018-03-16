const TokenFactory = artifacts.require("./TokenFactory.sol")
const ChronoBankAssetWithFeeFactory = artifacts.require("./ChronoBankAssetWithFeeFactory.sol");

module.exports = async (deployer, network, accounts) => {
    deployer.then(async () => {
        await deployer.deploy(ChronoBankAssetWithFeeFactory);

        let proxyFactory = await TokenFactory.deployed();
        await proxyFactory.setAssetFactory("ChronoBankAssetWithFee", ChronoBankAssetWithFeeFactory.address)
        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ChronoBankAssetWithFeeFactory init: #done")
    })
}
