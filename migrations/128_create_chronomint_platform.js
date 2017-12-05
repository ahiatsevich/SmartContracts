const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const AssetsManager = artifacts.require('./AssetsManager.sol')
const ChronoBankAssetOwnershipManager = artifacts.require('./ChronoBankAssetOwnershipManager.sol')
const TokenManagementInterface = artifacts.require('./TokenManagementInterface.sol')
const LOCWallet = artifacts.require('./LOCWallet.sol')
const RewardsWallet = artifacts.require('./RewardsWallet.sol')
const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')
const bytes32fromBase58 = require('../test/helpers/bytes32fromBase58')
const eventsHelper = require('../test/helpers/eventsHelper')

module.exports = function(deployer, network, accounts) {
    //----------
    const LHT_SYMBOL = 'LHT'
    const LHT_NAME = 'Labour-hour Token'
    const LHT_DESCRIPTION = 'ChronoBank Lht Assets'
    const LHT_BASE_UNIT = 8
    const IS_REISSUABLE = true
    const WITH_FEE = true

    const FEE_VALUE = 100 // 1%

    const systemOwner = accounts[0]

    var lhtIconIpfsHash = ""
    if (network !== "test") {
        //https://ipfs.infura.io:5001
        lhtIconIpfsHash = "Qmdhbz5DTrd3fLHWJ8DY2wyAwhffEZG9MoWMvbm3MRwh8V";
    }

    deployer
    .then(() => PlatformsManager.deployed())
    .then(_platformsManager => platformsManager = _platformsManager)
    .then(() => AssetsManager.deployed())
    .then(_manager => assetsManager = _manager)

    .then(() => platformsManager.createPlatform())
    .then(_tx => {
        // return Promise.resolve()
        // .then(() => )
        console.log("logs", _tx.logs)
        let event = eventsHelper.extractEvents(_tx, "PlatformRequested")[0]
        if (event !== undefined) {
            return event.args.platform
        } else {
            return Promise.resolve()
            .then(() => platformsManager.getPlatformForUserAtIndex.call(systemOwner, 0))
            .then(_platforms => _platforms)
        }
    })
    .then(_platformAddr => platformAddr = _platformAddr)
    .then(() => assetsManager.getTokenExtension.call(platformAddr))
    .then(_tokenExtensionAddr => TokenManagementInterface.at(_tokenExtensionAddr))
    .then(_tokenExtension => tokenExtension = _tokenExtension)
    .then(() => {
        return Promise.resolve()
        .then(() => tokenExtension.createAssetWithFee.call(LHT_SYMBOL, LHT_NAME, LHT_DESCRIPTION, 0, LHT_BASE_UNIT, IS_REISSUABLE, RewardsWallet.address, FEE_VALUE, bytes32fromBase58(lhtIconIpfsHash)))
        .then(_code => {
            if (_code == 1) {
                return tokenExtension.createAssetWithFee(LHT_SYMBOL, LHT_NAME, LHT_DESCRIPTION, 0, LHT_BASE_UNIT, IS_REISSUABLE, RewardsWallet.address, FEE_VALUE, bytes32fromBase58(lhtIconIpfsHash))
            } else {
                throw "Cannot create token LHT. Result code: " + _code.valueOf()
            }
        })
    })
    .then(() => tokenExtension.getAssetOwnershipManager.call())
    .then(_assetOwnershipManagerAddr => ChronoBankAssetOwnershipManager.at(_assetOwnershipManagerAddr))
    .then(_assetOwnershipManager => {
        return Promise.resolve()
        .then(() => _assetOwnershipManager.addAssetPartOwner(LHT_SYMBOL, LOCWallet.address))
    })

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PlatformsManager reinit: #done"))
}
