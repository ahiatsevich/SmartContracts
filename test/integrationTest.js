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

        it("should have in AssetsManager a tokens for system user", async () => {
            let [tokenSymbols, tokenAddresses, totalSupplies] = await Setup.assetsManager.getAssetsForOwner.call(systemOwner, systemOwner)
            tokenSymbols = tokenSymbols.map((e,i) => web3.toAscii(e).replace(/\0/g, ''))
            assert.isAtLeast(tokenSymbols.length, 1)
            assert.include(tokenSymbols, LHT_SYMBOL)
        })

        it("should have LOCWallet as one of owners of LHT token", async () => {
            let [tokenSymbols, tokenAddresses, totalSupplies] = await Setup.assetsManager.getAssetsForOwner.call(LOCWallet.address, systemOwner)
            tokenSymbols = tokenSymbols.map((e,i) => web3.toAscii(e).replace(/\0/g, ''))
            assert.isAtLeast(tokenSymbols.length, 1)
            assert.include(tokenSymbols, LHT_SYMBOL)
        })

        it("should have a list of tokens in Rewards contract", async () => {
            let tokens = await Setup.rewards.getAssets.call()
            let lhtTokenAddr = await Setup.erc20Manager.getTokenAddressBySymbol.call(LHT_SYMBOL)
            assert.isAtLeast(tokens.length, 1)
            assert.include(tokens, lhtTokenAddr)
        })
    })
})
