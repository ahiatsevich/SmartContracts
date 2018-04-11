const MultiEventsHistory = artifacts.require('MultiEventsHistory')
const PendingManager = artifacts.require("PendingManager")
const ERC20Manager = artifacts.require('ERC20Manager')
const ERC20Interface = artifacts.require('ERC20Interface')
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy')
const ChronoBankAssetWithFeeProxy = artifacts.require('ChronoBankAssetWithFeeProxy')
const ChronoBankAssetWithFee = artifacts.require('ChronoBankAssetWithFee')
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform')

const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const Setup = require('../setup/setup')
const ErrorsEnum = require("../common/errors")

async function tokenContractBySymbol(symbol, contract) {
    const tokenAddress = await Setup.erc20Manager.getTokenAddressBySymbol.call(symbol)
    return await contract.at(_address)
}

async function getAllPlatformsForUser(user) {
    let userPlatforms = []
    const platformsCount = await Setup.platformsManager.getPlatformsCount.call()
    const allPlatforms = await Setup.platformsManager.getPlatforms.call(0, platformsCount)

    for (var _platformAddr of allPlatforms) {
          const _platform = await ChronoBankPlatform.at(_platformAddr);
          const _owner = await _platform.contractOwner.call();
          if (_owner === user) {
              userPlatforms.push(_platformAddr);
          }
    }

    return userPlatforms
}

contract('LOC Manager', (accounts) => {

    const users = {
        contractOwner: accounts[0],
        user1: accounts[1],
        user2: accounts[3],
        cbe1: accounts[7],
        cbe2: accounts[8],
    }

    const Status = { 
        maintenance: 0, 
        active: 1, 
        suspended: 2, 
        bankrupt: 3,
    }

    const TIME_SYMBOL = 'TIME'
    const LHT_SYMBOL = 'LHT'

    before(async () => {
        await Setup.setupPromise()
    })

    context("check setup where", () => {
        let platformAddresses
        let platform

        before(async () => {
            platformAddresses = await getAllPlatformsForUser(users.contractOwner)
            platform = await ChronoBankPlatform.at(platformAddresses[0])
        })
        
        it("owner should have at least one platform in ownership", async () => {
            assert.isAtLeast(platformAddresses.length, 1)
        })

        it("platform should have correct LHT proxy address", async () => {
            const gotProxyAddr = await platform.proxies.call(LHT_SYMBOL)
            const registeredProxyAddr = await Setup.erc20Manager.getTokenAddressBySymbol.call(LHT_SYMBOL)

            assert.equal(registeredProxyAddr, gotProxyAddr)
        })        
    })

    context("standard use of LOC", () => {
        const locInfo = {
            name: "Bob's Hard Workers",
            website: "www.bobhardworkers.com",
            issueLimit: 100000,
            publishedIpfsHash: bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
            exprirationDate: Math.round(+new Date()/1000),
            currency: LHT_SYMBOL,
        }

        const updatedLocInfo = {
            name: "Bob&Sons' Hard Workers",
            website: "www.bobsonshardworkers.com",
            issueLimit: 350000,
            publishedIpfsHash: bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
            exprirationDate: Math.round(+new Date()/1000),
            currency: LHT_SYMBOL,
        }

        context("[preset] with two CBE confirmations", () => {
            it("contract owner should be CBE", async () => {
                assert.isTrue(await Setup.userManager.getCBE.call(users.contractOwner))
            })

            it("should have 0 required CBE for confirmation", async () => {
                assert.equal((await Setup.userManager.required.call()).toNumber(), 0)
            })

            it("should be able to add two additional CBE addresses", async () => {
                await Setup.userManager.addCBE(users.cbe1, "0x11", { from: users.contractOwner, })
                await Setup.userManager.addCBE(users.cbe2, "0x12", { from: users.contractOwner, })

                assert.isTrue(await Setup.userManager.getCBE.call(users.cbe1))
                assert.isTrue(await Setup.userManager.getCBE.call(users.cbe2))
            })

            it("should be able to update `required` number of confirmation up to 2 CBE", async () => {
                await Setup.userManager.setRequired(2, { from: users.contractOwner, })

                assert.equal((await Setup.userManager.required.call()).toNumber(), 2)
            })
        })

        context("add a new company", () => {

        })

        context("update company info", () => {

        })

        context("issue asset for company", () => {

        })

        context("revoke asset for company", () => {

        })

        context("generate rewards from issued assets", () => {

        })

    })
})
