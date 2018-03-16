const TokenFactory = artifacts.require("./TokenFactory.sol")
const ChronoBankAssetFactory = artifacts.require("./ChronoBankAssetFactory.sol");

module.exports = async (deployer, network, accounts) => {
    deployer.then(async () => {
        await deployer.deploy(ChronoBankAssetFactory);

        let proxyFactory = await TokenFactory.deployed();
        await proxyFactory.setAssetFactory("ChronoBankAsset", ChronoBankAssetFactory.address)
        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ChronoBankAssetFactory deploy: #done")
    })
}
