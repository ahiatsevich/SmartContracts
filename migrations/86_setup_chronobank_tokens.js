const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')
const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const AssetsManager = artifacts.require('./AssetsManager.sol')
const LOCWallet = artifacts.require('./LOCWallet.sol')
const ChronoBankAssetOwnershipManager = artifacts.require('./ChronoBankAssetOwnershipManager.sol')
const ERC20Interface = artifacts.require('./ERC20Interface.sol')
const AssetDonator = artifacts.require('./AssetDonator.sol')
const ContractsManager = artifacts.require('./ContractsManager.sol')

module.exports = function (deployer, network, accounts) {
    const TIME_SYMBOL = "TIME"
    const LHT_SYMBOL = "LHT"

    const systemOwner = accounts[0]

    deployer
    .then(() => ChronoBankPlatform.deployed())
    .then(_platform => chronoBankPlatform = _platform)
    .then(() => PlatformsManager.deployed())
    .then(_manager => platformsManager = _manager)
    .then(() => AssetsManager.deployed())
    .then(_manager => assetsManager = _manager)

    .then(() => {
        if (network !== 'main') {
            return Promise.resolve()
            .then(() => deployer.deploy(AssetDonator))
            .then(() => AssetDonator.deployed())
            .then(_donator => _donator.init(ContractsManager.address))
            .then(() => chronoBankPlatform.proxies(TIME_SYMBOL))
            .then(_proxyAddress => ERC20Interface.at(_proxyAddress))
            .then(_token => _token.transfer(AssetDonator.address, 1000000000000))
        }
    })

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Setup token extension for ChronoBankPlatform setup: #done"))
}
