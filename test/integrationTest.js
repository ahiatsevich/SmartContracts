const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const ErrorsEnum = require("../common/errors")
const ChronoBankAssetProxyInterface = artifacts.require('./ChronoBankAssetProxyInterface.sol')
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol')
const LOCWallet = artifacts.require('./LOCWallet.sol')

contract("Integration test", function(accounts) {
    const systemOwner = accounts[0]

    const LHT_SYMBOL = 'LHT'
    const TIME_SYMBOL = 'TIME'

    before("setup", function(done) {
        Setup.setup(done);
    })

    context("ChronoBank Platform", function () {

        it("should have TIME token registered in ERC20Manager", async () => {
            let tokenAddress = await Setup.erc20Manager.getTokenAddressBySymbol.call(TIME_SYMBOL)
            assert.notEqual(tokenAddress, 0x0)
        })

        it("should have LHT token registered in ERC20Manager", async () => {
            let tokenAddress = await Setup.erc20Manager.getTokenAddressBySymbol.call(LHT_SYMBOL)
            assert.notEqual(tokenAddress, 0x0)
        })

        it("should have backed ChronoBankAsset contract in LHT token", async () => {
            let tokenAddress = await Setup.erc20Manager.getTokenAddressBySymbol.call(LHT_SYMBOL)
            let token = await ChronoBankAssetProxy.at(tokenAddress)
            let assetAddress = await token.getLatestVersion.call()
            assert.notEqual(assetAddress, 0x0)
        })

        it("should have 2 owners for LHT", async () => {
            assert.isTrue(await Setup.assetsManager.isAssetOwner.call(LHT_SYMBOL, systemOwner))
            assert.isTrue(await Setup.assetsManager.isAssetOwner.call(LHT_SYMBOL, LOCWallet.address))
        })

        it("should have a list of tokens in Rewards contract", async () => {
            let tokens = await Setup.rewards.getAssets.call()
            let lhtTokenAddr = await Setup.erc20Manager.getTokenAddressBySymbol.call(LHT_SYMBOL)
            assert.isAtLeast(tokens.length, 1)
            assert.include(tokens, lhtTokenAddr)
        })
    })
})
