const MultiEventsHistory = artifacts.require('MultiEventsHistory')
const PendingManager = artifacts.require("PendingManager")
const ERC20Manager = artifacts.require('ERC20Manager')
const ERC20Interface = artifacts.require('ERC20Interface')
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy')
const ChronoBankAssetWithFeeProxy = artifacts.require('ChronoBankAssetWithFeeProxy')
const ChronoBankAssetWithFee = artifacts.require('ChronoBankAssetWithFee')
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform')
const Stub = artifacts.require('Stub')
const LOCWallet = artifacts.require('LOCWallet')

const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const utils = require('./helpers/utils')
const Setup = require('../setup/setup')
const ErrorsEnum = require("../common/errors")


async function tokenContractBySymbol(symbol, contract) {
    const tokenAddress = await Setup.erc20Manager.getTokenAddressBySymbol.call(symbol)
    return await contract.at(tokenAddress)
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

async function isLOCExist(locName) {
    const creationDate = await getLOCCreationDate(locName)
    return creationDate !== 0
}

async function getLOCStatus(locName) {
    const [ ,,,,,, status, ] = await Setup.chronoMint.getLOCByName.call(locName)
    return status.toNumber()
}

async function getLOCIssued(locName) {
    const [ ,, issued, ] = await Setup.chronoMint.getLOCByName.call(locName)
    return issued.toNumber()
}

async function getLOCCreationDate(locName) {
    const [ ,,,,,,,,, creationDate, ] = await Setup.chronoMint.getLOCByName.call(locName)
    return creationDate.toNumber()
}

async function confirmMultisig(tx, cbes) {
    let confirmationHash

    if (tx.receipt === undefined) {
        confirmationHash = tx
    }
    else {
        const doneEvent = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
        if (doneEvent !== undefined) {
            return [ true, tx, ]
        }
    
        const addTxEvent = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
        const confirmEvent = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
    
        if (addTxEvent !== undefined) {
            confirmationHash = addTxEvent.args.hash
        }
        else if (confirmEvent !== undefined) {
            confirmationHash = confirmEvent.args.hash
        }
        else {
            return [ false, tx, ]
        }
    }

    var lastTx
    for (var cbe of cbes) {
        lastTx = await Setup.shareable.confirm(confirmationHash, { from: cbe, })
        // console.log(`### cbe (${cbe}) confirms: ${JSON.stringify(lastTx, null, 4)}`)
        const doneEvent = (await eventsHelper.findEvent([Setup.shareable,], lastTx, "Done"))[0]
        
        // console.log(`### cbe (${cbe}) doneEvent: ${JSON.stringify(doneEvent, null, 4)}`)
        if (doneEvent !== undefined) {
            return [ true, lastTx, ]
        }
    }

    console.log(`### "Done" not found`)
    
    return [ false, lastTx || tx, ]  
}

/**
 * @internal Gets a function which calculates a final amount including passed percent.
 * For example, percent = 0.01, amount = 1000; return value = 1010
 * @param {number} percent (from 0.01 to 1, where 1 == 100%) 
 */
function calculateTransferFee(percent) {
    return function (amount) {
        return amount + amount * percent
    }
}

/**
 * @internal Gets a function which takes final amount and returns an amount
 * that when summarizing with its percent results in passed amount. For example,
 * percent = 0.01, amount = 1000; return value = 990.1. If you take 990.1 and 
 * summarize it with 1% of 990.1 you will get 1000.
 * @param {number} percent (from 0.01 to 1, where 1 == 100%)
 */
function calculateAmountToTransferFee(percent) {
    return function (amount) {
        return amount / (1 + percent)
    }
}


contract('LOC Manager', (accounts) => {

    const reverter = new Reverter(web3)

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

    const contracts = {}
    const multisigRequired = 2
    let feePercent
    let calculateFullTransferValue

    before(async () => {
        await Setup.setupPromise()

        contracts.typeHelper = await Stub.deployed()
        Setup.chronoMint._isLOCExist = isLOCExist
        Setup.chronoMint._getLOCStatus = getLOCStatus
        Setup.chronoMint._getLOCIssued = getLOCIssued
        Setup.chronoMint._getLOCCreationDate = getLOCCreationDate
        Setup.shareable._confirmMultisig = confirmMultisig

        const tokenWithFee = await tokenContractBySymbol(LHT_SYMBOL, ChronoBankAssetProxy)
        const assetWithFeeAddress = await tokenWithFee.getLatestVersion.call()
        const assetWithFee = await ChronoBankAssetWithFee.at(assetWithFeeAddress)
        feePercent = (await assetWithFee.feePercent.call()).toNumber() / 10000.0
        calculateFullTransferValue = calculateTransferFee(feePercent)

        await reverter.promisifySnapshot()
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
        
        it("loc manager should have correct wallet address", async () => {
            assert.equal(await Setup.chronoMint.wallet.call(), Setup.chronoMintWallet.address)
        })
    })

    context("standard use of LOC", () => {
        const locInfo = {
            name: "Bob's Hard Workers",
            website: "www.bobhardworkers.com",
            issueLimit: 100000,
            underLimitAssetAmount: 90000,
            overLimitAssetAmount: 110000,
            publishedIpfsHash: bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
            exprirationDate: Math.round(+new Date()/1000),
            currency: LHT_SYMBOL,
        }

        const secondLocInfo = {
            name: "Jonson's Baby",
            website: "www.jonsonsbaby.eu",
            issueLimit: 100500,
            underLimitAssetAmount: 100300,
            overLimitAssetAmount: 100600,
            publishedIpfsHash: bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
            exprirationDate: Math.round(+new Date()/1000),
            currency: LHT_SYMBOL,
        }

        const updatedLocInfo = {
            name: "Bob&Sons' Hard Workers",
            website: "www.bobsonshardworkers.com",
            issueLimit: 350000,
            underLimitAssetAmount: 300000,
            overLimitAssetAmount: 400000,
            publishedIpfsHash: bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
            exprirationDate: Math.round(+new Date()/1000),
            currency: LHT_SYMBOL,
        }

        const notExistedLocName = "Not existed company"

        context(`[preset] with ${multisigRequired} CBE confirmations`, () => {
            it("contract owner should be CBE", async () => {
                assert.isTrue(await Setup.userManager.getCBE.call(users.contractOwner))
            })

            it("should have 0 required CBE for confirmation", async () => {
                assert.equal((await Setup.userManager.required.call()).toNumber(), 0)
            })

            it(`should be able to add ${multisigRequired} additional CBE addresses`, async () => {
                await Setup.userManager.addCBE(users.cbe1, "0x11", { from: users.contractOwner, })
                await Setup.userManager.addCBE(users.cbe2, "0x12", { from: users.contractOwner, })

                assert.isTrue(await Setup.userManager.getCBE.call(users.cbe1))
                assert.isTrue(await Setup.userManager.getCBE.call(users.cbe2))
            })

            it(`should be able to update "required" number of confirmation up to ${multisigRequired} CBE`, async () => {
                await Setup.userManager.setRequired(2, { from: users.contractOwner, })

                assert.equal((await Setup.userManager.required.call()).toNumber(), 2)
            })
        })

        context("add a new company (without multisig) and", () => {

            after(async () => {
                await Setup.chronoMint.addLOC(
                    secondLocInfo.name,
                    secondLocInfo.website,
                    secondLocInfo.issueLimit,
                    secondLocInfo.publishedIpfsHash,
                    secondLocInfo.exprirationDate,
                    secondLocInfo.currency,
                    { from: users.cbe1, }
                )
                assert.isTrue(await Setup.chronoMint._isLOCExist(secondLocInfo.name))
            })

            it("should not be able to add new LOC by non-authorized (non-CBE) user with UNAUTHORIZED code", async () => {
                assert.equal((await Setup.chronoMint.addLOC.call(
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    locInfo.currency,
                    { from: users.user1, }
                )).toNumber(), ErrorsEnum.UNAUTHORIZED)
            })

            it("should not be able to add new LOC by non-authorized (non-CBE) user", async () => {
                const initialLOCsCount = (await Setup.chronoMint.getLOCCount.call()).toNumber()
                const tx = await Setup.chronoMint.addLOC(
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    locInfo.currency,
                    { from: users.user1, }
                )
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "NewLOC"))[0]
                assert.isUndefined(event)

                assert.equal((await Setup.chronoMint.getLOCCount.call()).toNumber(), initialLOCsCount)
            })

            it("should THROW and not be able to add new LOC with null name", async () => {
                try {
                    await Setup.chronoMint.addLOC.call(
                        "",
                        locInfo.website,
                        locInfo.issueLimit,
                        locInfo.publishedIpfsHash,
                        locInfo.exprirationDate,
                        locInfo.currency,
                        { from: users.cbe1, }
                    )
                    assert(false)
                }
                catch (e) {
                    utils.ensureException(e)
                }
            })

            it("should THROW and not be able to add new LOC with not existed currency", async () => {
                const notExistedCurrency = "NEC"
                assert.equal(await Setup.erc20Manager.getTokenAddressBySymbol.call(notExistedCurrency), utils.zeroAddress)

                try {
                    await Setup.chronoMint.addLOC.call(
                        locInfo.name,
                        locInfo.website,
                        locInfo.issueLimit,
                        locInfo.publishedIpfsHash,
                        locInfo.exprirationDate,
                        notExistedCurrency,
                        { from: users.cbe1, }
                    )
                }
                catch (e) {
                    utils.ensureException(e)
                }
            })

            it("should THROW and not be able to add new LOC with expired date", async () => {
                try {
                    await Setup.chronoMint.addLOC.call(
                        locInfo.name,
                        locInfo.website,
                        locInfo.issueLimit,
                        locInfo.publishedIpfsHash,
                        2,
                        locInfo.currency,
                        { from: users.cbe1, }
                    )
                }
                catch (e) {
                    utils.ensureException(e)
                }
            })

            it("should THROW and not be able to add new LOC with NULL publishedIpfsHash", async () => {
                try {
                    await Setup.chronoMint.addLOC.call(
                        locInfo.name,
                        locInfo.website,
                        locInfo.issueLimit,
                        "",
                        locInfo.exprirationDate,
                        locInfo.currency,
                        { from: users.cbe1, }
                    )
                }
                catch (e) {
                    utils.ensureException(e)
                }
            })

            it("should be able to add new LOC by CBE user with OK code", async () => {
                assert.equal((await Setup.chronoMint.addLOC.call(
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    locInfo.currency,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.OK)
            })

            it("should be able to add new LOC by CBE user", async () => {
                const initialLOCsCount = (await Setup.chronoMint.getLOCCount.call()).toNumber()
                const tx = await Setup.chronoMint.addLOC(
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    locInfo.currency,
                    { from: users.cbe1, }
                )
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "NewLOC"))[0]
                assert.isDefined(event)
                assert.equal(event.args.locName, (await contracts.typeHelper.convertToBytes32.call(locInfo.name)))
                assert.equal(event.args.count, initialLOCsCount + 1)

                assert.equal((await Setup.chronoMint.getLOCCount.call()).toNumber(), initialLOCsCount + 1)
            })

            it("should not be able to add LOC that already exists with LOC_EXISTS code", async () => {
                assert.equal((await Setup.chronoMint.addLOC.call(
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    locInfo.currency,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.LOC_EXISTS)
            })

            it("should not be able to add LOC that already exists", async () => {
                const initialLOCsCount = (await Setup.chronoMint.getLOCCount.call()).toNumber()
                const tx = await Setup.chronoMint.addLOC(
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    locInfo.currency,
                    { from: users.cbe1, }
                )
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "NewLOC"))[0]
                assert.isUndefined(event)

                assert.equal((await Setup.chronoMint.getLOCCount.call()).toNumber(), initialLOCsCount)
            })

            it("created loc should have 'maintenance' status after creation", async () => {
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.maintenance)
            })
        })

        context("update LOC status (with multisig) where", () => {
            let confirmationHash

            after(async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.maintenance, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
            })

            it("any user should be able to initiate transfer 'suspended' state with MULTISIG_ADDED code", async () => {
                assert.equal((await Setup.chronoMint.setStatus.call(locInfo.name, Status.suspended, { from: users.user1, })).toNumber(), ErrorsEnum.MULTISIG_ADDED)
            })

            it("any user should be able to initiate transfer 'suspended' state", async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.suspended, { from: users.user1, })
                const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
                assert.isDefined(event)

                confirmationHash = event.args.hash
            })

            it("pending manager should have one pending operation in queue", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 1)
            })

            it(`pending manager should require ${multisigRequired} more confirmations`, async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), multisigRequired)
            })

            it("CBEs should be able to confirm status change", async () => {
                const [ successConfirmation, tx, ] = await Setup.shareable._confirmMultisig(confirmationHash, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successConfirmation)
                
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "UpdLOCStatus"))[0]
                assert.isDefined(event)
                assert.equal(event.args.locName, await contracts.typeHelper.convertToBytes32.call(locInfo.name))
                assert.equal(event.args.oldStatus, Status.maintenance)
                assert.equal(event.args.newStatus, Status.suspended)
            })

            it("pending manager should have 0 pending operation in queue", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
            })

            it("loc status should be set to 'suspended' state", async () => {
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.suspended)
            })
        })

        context("update company info (without multisig) and", () => {
            let initialLocCreationDate
            const initialLocInfo = {
                creationDate: 0,
                issued: 0,
            }

            before(async () => {
                initialLocInfo.creationDate = await Setup.chronoMint._getLOCCreationDate(locInfo.name)
                initialLocInfo.issued = await Setup.chronoMint._getLOCIssued(locInfo.name)
            })

            after(async () => {
                await Setup.chronoMint.setLOC(
                    updatedLocInfo.name,
                    locInfo.name,
                    locInfo.website,
                    locInfo.issueLimit,
                    locInfo.publishedIpfsHash,
                    locInfo.exprirationDate,
                    { from: users.cbe1, }
                )
            })

            it(`second LOC ${secondLocInfo.name} should be created`, async () => {
                assert.isTrue(await Setup.chronoMint._isLOCExist(secondLocInfo.name))
            })

            it("should not be able to update LOC info by non-authorized (non-CBE) user with UNAUTHORIZED code", async () => {
                assert.equal((await Setup.chronoMint.setLOC.call(
                    locInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.user1, }
                )).toNumber(), ErrorsEnum.UNAUTHORIZED)
            })

            it("should not be able to update LOC info by non-authorized (non-CBE) user", async () => {
                const tx = await Setup.chronoMint.setLOC(
                    locInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.user1, }
                )
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "UpdateLOC"))[0]
                assert.isUndefined(event)

                assert.isFalse(await Setup.chronoMint._isLOCExist(updatedLocInfo.name))
            })

            it(`should not have LOC with "${notExistedLocName}" name`, async () => {
                assert.isFalse(await Setup.chronoMint._isLOCExist(notExistedLocName))
            })

            it("should not be able to update LOC info for not existed LOC with LOC_NOT_FOUND code", async () => {
                assert.equal((await Setup.chronoMint.setLOC.call(
                    notExistedLocName,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.LOC_NOT_FOUND)
            })

            it("should not be able to update LOC info with null name with LOC_NOT_FOUND code", async () => {
                assert.equal((await Setup.chronoMint.setLOC.call(
                    "",
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.LOC_NOT_FOUND)
            })

            it("should be able to put LOC into 'active' state", async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.active, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
            })

            it("should not be able to update LOC info when LOC is in 'active' state with LOC_SHOULD_NO_BE_ACTIVE code", async () => {
                assert.equal((await Setup.chronoMint.setLOC.call(
                    locInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.LOC_SHOULD_NO_BE_ACTIVE)
            })

            it("should not be able to update LOC info when LOC is in 'active' state", async () => {
                const tx = await Setup.chronoMint.setLOC(
                    locInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "UpdateLOC"))[0]
                assert.isUndefined(event)

                assert.isFalse(await Setup.chronoMint._isLOCExist(updatedLocInfo.name))
            })

            let stateBeforeSetLOC

            it("should be able to put LOC back into 'suspended' state", async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.suspended, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                stateBeforeSetLOC = await Setup.chronoMint._getLOCStatus(locInfo.name)
                assert.equal(stateBeforeSetLOC, Status.suspended)
            })

            it("should be able to update LOC info by CBE user with OK code", async () => {
                assert.equal((await Setup.chronoMint.setLOC.call(
                    locInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.OK)
            })

            let firstLOCUpdateGasUsed

            it("should be able to update LOC info by CBE user", async () => {
                const tx = await Setup.chronoMint.setLOC(
                    locInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )
                console.log(`setLOC tx [${tx.tx}]; gasUsed = ${tx.receipt.gasUsed}`);
                firstLOCUpdateGasUsed = tx.receipt.gasUsed
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "UpdateLOC"))[0]
                assert.isDefined(event)

                assert.isTrue(await Setup.chronoMint._isLOCExist(updatedLocInfo.name))
                assert.isFalse(await Setup.chronoMint._isLOCExist(locInfo.name))
            })

            it("should still have the state set before setLOC", async () => {
                assert.equal(await Setup.chronoMint._getLOCStatus(updatedLocInfo.name), stateBeforeSetLOC)
            })

            it("should have updated values for LOC", async () => {
                const [ 
                    locName, 
                    locWebsite,
                    locIssued,
                    locIssueLimit,
                    locPublishedHash,
                    locExpiredDate,
                    ,
                    locSecurity,
                    locCurrency,
                    locCreationDate,
                ] = await Setup.chronoMint.getLOCByName.call(updatedLocInfo.name)

                assert.equal(locWebsite,  await contracts.typeHelper.convertToBytes32.call(updatedLocInfo.website))
                assert.equal(locIssued.toNumber(), initialLocInfo.issued)
                assert.equal(locIssueLimit.toNumber(), updatedLocInfo.issueLimit)
                assert.equal(locPublishedHash, await contracts.typeHelper.convertToBytes32.call(updatedLocInfo.publishedIpfsHash))
                assert.equal(locExpiredDate.toNumber(), updatedLocInfo.exprirationDate)
                assert.equal(locSecurity.toNumber(), 10)
                assert.equal(locCurrency, await contracts.typeHelper.convertToBytes32.call(updatedLocInfo.currency))
                assert.equal(locCreationDate.toNumber(), initialLocInfo.creationDate)
            })

            it("loc manager should not have any records about old LOC info", async () => {
                const [ 
                    locName, 
                    locWebsite,
                    locIssued,
                    locIssueLimit,
                    locPublishedHash,
                    locExpiredDate,
                    locStatus,
                    locSecurity,
                    locCurrency,
                    locCreationDate,
                ] = await Setup.chronoMint.getLOCByName.call(locInfo.name)

                assert.equal(locWebsite, await contracts.typeHelper.convertToBytes32.call(""))
                assert.equal(locIssued.toNumber(), 0)
                assert.equal(locIssueLimit.toNumber(), 0)
                assert.equal(locPublishedHash, await contracts.typeHelper.convertToBytes32.call(""))
                assert.equal(locExpiredDate.toNumber(), 0)
                assert.equal(locStatus.toNumber(), 0)
                assert.equal(locSecurity.toNumber(), 10)
                assert.equal(locCurrency, await contracts.typeHelper.convertToBytes32.call(""))
                assert.equal(locCreationDate.toNumber(), 0)
            })

            it("loc manager should not have old LOC name in the list of LOC names", async () => {
                assert.notInclude(await Setup.chronoMint.getLOCNames.call(), await contracts.typeHelper.convertToBytes32.call(locInfo.name))
            })

            it("should be able to pass the same info for the second time with less gas cost", async () => {
                const tx = await Setup.chronoMint.setLOC(
                    updatedLocInfo.name,
                    updatedLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )
                console.log(`setLOC tx [${tx.tx}]; gasUsed = ${tx.receipt.gasUsed}`);
                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "UpdateLOC"))[0]
                assert.isDefined(event)

                assert.isBelow(tx.receipt.gasUsed, firstLOCUpdateGasUsed)
            })

            it(`should not be able to update LOC info with the existed name of "${secondLocInfo.name}" with LOC_INVALID_INVOCATION code`, async () => {
                assert.equal((await Setup.chronoMint.setLOC.call(
                    updatedLocInfo.name,
                    secondLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )).toNumber(), ErrorsEnum.LOC_INVALID_INVOCATION)
            })
            
            it(`should not be able to update LOC info with the existed name of "${secondLocInfo.name}"`, async () => {
                const tx = await Setup.chronoMint.setLOC(
                    updatedLocInfo.name,
                    secondLocInfo.name,
                    updatedLocInfo.website,
                    updatedLocInfo.issueLimit,
                    updatedLocInfo.publishedIpfsHash,
                    updatedLocInfo.exprirationDate,
                    { from: users.cbe1, }
                )

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], tx, "UpdateLOC"))[0]
                assert.isUndefined(event)
            })
            
            it("LOC's status should still have `maintenance` status", async () => {
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.maintenance)
            })
        })

        context("work with assets in LOC company", () => {
            var initialWalletBalance
            let token
    
            before(async () => {
                token = await tokenContractBySymbol(LHT_SYMBOL, ChronoBankAssetProxy)
                initialWalletBalance = (await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber()

                await reverter.promisifySnapshot()
            })

            after(async () => {
                await reverter.promisifyRevert()
            })
    
            describe("issuing (with multisig)", () => {
    
                after(async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.maintenance, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.maintenance)
                })
    
                it("should not be able to reissue assets while in 'maintenance' state with LOC_INACTIVE code", async () => {
                    const reissueAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.reissueAsset(reissueAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_INACTIVE)
                })
    
                it("should not have 'issued' amount", async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), 0)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
    
                it("should be able to put LOC into 'suspended' state", async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.suspended, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.suspended)
                })
    
                it("should not be able to reissue assets while in 'suspended' state with LOC_INACTIVE code", async () => {
                    const reissueAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.reissueAsset(reissueAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_INACTIVE)
                })
    
                it("should not have 'issued' amount", async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), 0)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
    
                it("should be able to put LOC into 'bankrupt' state", async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.bankrupt, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.bankrupt)
                })
    
                it("should not be able to reissue assets while in 'bankrupt' state with LOC_INACTIVE code", async () => {
                    const reissueAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.reissueAsset(reissueAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_INACTIVE)
                })
    
                it("should not have 'issued' amount", async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), 0)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
    
                it("should be able to put LOC into 'active' state", async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.active, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
                })
    
                it("should be able to reissue assets while in 'active' state with OK code", async () => {
                    const reissueAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.reissueAsset(reissueAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Reissue"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.locName, await contracts.typeHelper.convertToBytes32.call(locInfo.name))
                    assert.equal(event.args.value, locInfo.underLimitAssetAmount)
                })
    
                it(`should have updated 'issued'=${locInfo.underLimitAssetAmount} amount`, async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), locInfo.underLimitAssetAmount)
                })
    
                it("should change wallet balance to have reissued asset amount", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance + locInfo.underLimitAssetAmount)
    
                    initialWalletBalance = initialWalletBalance + locInfo.underLimitAssetAmount
                })
    
                it("should not be able to reissue more than issue limit with LOC_REQUESTED_ISSUE_VALUE_EXCEEDED code", async () => {
                    const reissueAmount = (locInfo.issueLimit - initialWalletBalance) + 1
                    const tx = await Setup.chronoMint.reissueAsset(reissueAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_REQUESTED_ISSUE_VALUE_EXCEEDED)
                })
    
                it("should have the same 'issued' amount", async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), locInfo.underLimitAssetAmount)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
            })
    
            context("revoking (with multisig)", () => {

                it("LOC's status should still have `maintenance` status", async () => {
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.maintenance)
                })
    
                it(`should have 'issued'=${locInfo.underLimitAssetAmount} amount`, async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), locInfo.underLimitAssetAmount)
                })
    
                it("should not be able to revoke assets while in 'maintenance' state with LOC_INACTIVE code", async () => {
                    const revokeAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.revokeAsset(revokeAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_INACTIVE)
                })
    
                it(`should have 'issued'=${locInfo.underLimitAssetAmount} amount`, async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), locInfo.underLimitAssetAmount)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
    
                it("should be able to put LOC into 'suspended' state", async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.suspended, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.suspended)
                })
    
                it("should not be able to revoke assets while in 'suspended' state with LOC_INACTIVE code", async () => {
                    const revokeAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.revokeAsset(revokeAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_INACTIVE)
                })
    
                it(`should have 'issued'=${locInfo.underLimitAssetAmount} amount`, async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), locInfo.underLimitAssetAmount)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
    
                it("should be able to put LOC into 'bankrupt' state", async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.bankrupt, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.bankrupt)
                })
    
                it("should not be able to revoke assets while in 'bankrupt' state with LOC_INACTIVE code", async () => {
                    const revokeAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.revokeAsset(revokeAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.LOC_INACTIVE)
                })
    
                it(`should have 'issued'=${locInfo.underLimitAssetAmount} amount`, async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), locInfo.underLimitAssetAmount)
                })
    
                it("should not change wallet balance", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
                })
    
                it("should be able to put LOC into 'active' state", async () => {
                    const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.active, { from: users.cbe1, })
                    assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                    assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
                })
    
                it("should be able to revoke assets while in 'active' state with OK code", async () => {
                    const revokeAmount = locInfo.underLimitAssetAmount
                    const tx = await Setup.chronoMint.revokeAsset(revokeAmount, locInfo.name, { from: users.cbe1, })
                    const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                    assert.isTrue(successConfirmation)
                    
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Revoke"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.locName, await contracts.typeHelper.convertToBytes32.call(locInfo.name))
                    assert.equal(event.args.value, locInfo.underLimitAssetAmount)
                })
    
                it(`should have no 'issued' amount`, async () => {
                    assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), 0)
                })
    
                it("should change wallet balance to have initial asset amount", async () => {
                    assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance - locInfo.underLimitAssetAmount)
    
                    initialWalletBalance = initialWalletBalance - locInfo.underLimitAssetAmount
                })
            })
        })

        context("send assets to users (with multisig) where", () => {
            let initialWalletBalance
            let token
            let reissuedAmount = locInfo.underLimitAssetAmount

            before(async () => {
                token = await tokenContractBySymbol(LHT_SYMBOL, ChronoBankAssetProxy)
                initialWalletBalance = (await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber()

                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.active, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
            })

            after(async () => {
                await reverter.promisifyRevert()

                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.suspended, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.suspended)
            })

            it("loc manager should be in 'active' status", async () => {
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
            })

            it(`should have no issued assets for "${locInfo.name}" LOC`, async () => {
                assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), 0)
            })

            it(`should be able to issue ${reissuedAmount} amount of tokens`, async () => {
                const tx = await Setup.chronoMint.reissueAsset(reissuedAmount, locInfo.name, { from: users.cbe1, })
                const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Reissue"))[0]
                assert.isDefined(event)
            })

            it(`should have ${reissuedAmount} issued assets for "${locInfo.name}" LOC`, async () => {
                assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), reissuedAmount)
            })

            it(`wallet should have balance plus reissued ${reissuedAmount} value`, async () => {
                assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance + reissuedAmount)
                
                initialWalletBalance = initialWalletBalance + reissuedAmount
            })

            let firstPartAssetAmount = Math.floor(reissuedAmount / 3)
            var leftPartAssetAmount = reissuedAmount - firstPartAssetAmount

            it("transfered amount should be less than issued amount", () => {
                assert.isBelow(firstPartAssetAmount, reissuedAmount)
            })

            it(`should be able to send ${firstPartAssetAmount} to a user1 ${users.user1} `, async () => {
                const tx = await Setup.chronoMint.sendAsset(LHT_SYMBOL, users.user1, firstPartAssetAmount, { from: users.cbe1, })
                const [ successfulConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successfulConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "AssetSent"))[0]
                assert.isDefined(event)
                assert.equal(event.args.symbol, await contracts.typeHelper.convertToBytes32.call(LHT_SYMBOL))
                assert.equal(event.args.value, firstPartAssetAmount)

                leftPartAssetAmount = reissuedAmount - calculateFullTransferValue(firstPartAssetAmount)
            })

            it(`wallet should have balance minus ${firstPartAssetAmount} value (and fee value)`, async () => {
                assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance - (reissuedAmount - leftPartAssetAmount))
                
                initialWalletBalance = initialWalletBalance - (reissuedAmount - leftPartAssetAmount)
            })

            it(`should not be able to revoke assets for more than left after the transfer`, async () => {
                const tryToRevokeAssetAmount = leftPartAssetAmount + 1
                const tx = await Setup.chronoMint.revokeAsset(tryToRevokeAssetAmount, locInfo.name, { from: users.cbe1, })
                const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                assert.isDefined(event)
                assert.equal(event.args.errorCode, ErrorsEnum.LOC_REVOKING_ASSET_FAILED)
            })

            it("wallet balance should not change after failed attemp to revoke assets", async () => {
                assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance)
            })

            it("loc manager should not reduce 'issued' amount of assets", async () => {
                assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), reissuedAmount)
            })

            it(`wallet should have at least 'issued - transfered - fee' amount of tokens on its balance`, async () => {
                assert.isAtLeast((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), leftPartAssetAmount)
            })

            it("should be able to revoke rest of assets left on wallet's balance", async () => {
                const revokeAmount = leftPartAssetAmount
                const tx = await Setup.chronoMint.revokeAsset(revokeAmount, locInfo.name, { from: users.cbe1, })
                const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Revoke"))[0]
                assert.isDefined(event)
                assert.equal(event.args.value, revokeAmount)
            })

            it(`wallet should have decrease balance for left value`, async () => {
                assert.equal((await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber(), initialWalletBalance - leftPartAssetAmount)

                initialWalletBalance = initialWalletBalance - leftPartAssetAmount
            })

            it(`loc manager should reduce 'issued' amount of assets for 'issuedAmount - left' value`, async () => {
                assert.equal(await Setup.chronoMint._getLOCIssued(locInfo.name), reissuedAmount - leftPartAssetAmount)
            })
        })

        context("generate rewards from issued assets", () => {
            let initialWalletBalance
            let token
            let shareToken
            let reissuedAmount = locInfo.issueLimit
            let shareTokenBalance = 10000
            let initialUser2Balance

            before(async () => {
                token = await tokenContractBySymbol(LHT_SYMBOL, ChronoBankAssetProxy)
                initialWalletBalance = (await token.balanceOf(await Setup.chronoMintWallet.address)).toNumber()
                initialUser2Balance = (await token.balanceOf(users.user2)).toNumber()
                
                shareToken = await tokenContractBySymbol(TIME_SYMBOL, ChronoBankAssetProxy)
            })

            after(async () => {
                await reverter.promisifyRevert()
            })

            it("should be able to put LOC into 'active' state", async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.active, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
            })

            it(`should be able to reissue assets for ${reissuedAmount} amount`, async () => {
                const tx = await Setup.chronoMint.reissueAsset(reissuedAmount, locInfo.name, { from: users.cbe1, })
                const [ successConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Reissue"))[0]
                assert.isDefined(event)
            })

            let userTransferedAssetAmount = Math.floor(reissuedAmount / 4)
            let leftAssetAmount = reissuedAmount - userTransferedAssetAmount
            let feeTaken

            it(`should be able to send ${userTransferedAssetAmount} to user1`, async () => {
                const tx = await Setup.chronoMint.sendAsset(LHT_SYMBOL, users.user1, userTransferedAssetAmount, { from: users.cbe1, })
                const [ successfulConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successfulConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "AssetSent"))[0]
                assert.isDefined(event)

                leftAssetAmount = reissuedAmount - calculateFullTransferValue(userTransferedAssetAmount)
                feeTaken = calculateFullTransferValue(userTransferedAssetAmount) - userTransferedAssetAmount
            })

            it("user should have sent assets on his balance", async () => {
                assert.equal((await token.balanceOf.call(users.user1)).toNumber(), userTransferedAssetAmount)
            })

            it(`should be able to send ${TIME_SYMBOL} tokens to user2 to participate in rewards distribution`, async () => {
                await shareToken.transfer(users.user2, shareTokenBalance, { from: users.contractOwner, })
                assert.equal((await shareToken.balanceOf.call(users.user2)).toNumber(), shareTokenBalance)
            })

            it(`should be able to deposit share token to TimeHolder`, async () => {
                await shareToken.approve(await Setup.timeHolder.wallet.call(), shareTokenBalance, { from: users.user2, })
                await Setup.timeHolder.deposit(shareToken.address, shareTokenBalance, { from: users.user2, })
                assert.equal((await Setup.timeHolder.getDepositBalance.call(shareToken.address, users.user2)).toNumber(), shareTokenBalance)
            })

            it(`rewards should have no closed periods yet`, async () => {
                assert.equal((await Setup.rewards.periodsLength.call()).toNumber(), 0)
            })

            it("rewards should be able to close period with OK code", async () => {
                assert.equal((await Setup.rewards.closePeriod.call({ from: users.cbe1, })).toNumber(), ErrorsEnum.OK)
            })

            it("rewards should be able to close period", async () => {
                const tx = await Setup.rewards.closePeriod({ from: users.cbe1, })
                const event = (await eventsHelper.findEvent([Setup.rewards,], tx, "PeriodClosed"))[0]
                assert.isDefined(event)
            })

            it("user2 should be able to see his rewards", async () => {
                assert.equal((await Setup.rewards.rewardsFor.call(token.address, users.user2)).toNumber(), feeTaken)
            })

            it("user2 should be able to withdraw his rewards on his account with OK code", async () => {
                assert.equal((await Setup.rewards.withdrawReward.call(token.address, feeTaken, { from: users.user2, })).toNumber(), ErrorsEnum.OK)
            })

            it("user2 should be able to withdraw his rewards on his account", async () => {
                await Setup.rewards.withdrawReward(token.address, feeTaken, { from: users.user2, })
                assert.equal((await token.balanceOf.call(users.user2)).toNumber(), initialUser2Balance + feeTaken)
            })
        })

        context("remove LOC company (with multisig) where", () => {

            before(async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.active, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
            })

            it("should be in 'active' state", async () => {
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.active)
            })

            it("LOC should not be deleted in 'active' state with LOC_SHOULD_NO_BE_ACTIVE code", async () => {
                const tx = await Setup.chronoMint.removeLOC(locInfo.name, { from: users.cbe1, })
                const [ successfulConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successfulConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                assert.isDefined(event)
                assert.equal(event.args.errorCode, ErrorsEnum.LOC_SHOULD_NO_BE_ACTIVE)
            })

            it("should be able to put LOC into 'suspended' state", async () => {
                const tx = await Setup.chronoMint.setStatus(locInfo.name, Status.suspended, { from: users.cbe1, })
                assert.isTrue((await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ]))[0])
                assert.equal(await Setup.chronoMint._getLOCStatus(locInfo.name), Status.suspended)
            })

            it(`should not be able to delete not existed "${notExistedLocName}" LOC with LOC_NOT_FOUND code`, async () => {
                const tx = await Setup.chronoMint.removeLOC(notExistedLocName, { from: users.cbe1, })
                const [ successfulConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successfulConfirmation)

                const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                assert.isDefined(event)
                assert.equal(event.args.errorCode, ErrorsEnum.LOC_NOT_FOUND)
            })

            it("should be able to delete LOC", async () => {
                const tx = await Setup.chronoMint.removeLOC(locInfo.name, { from: users.cbe1, })
                const [ successfulConfirmation, lastTx, ] = await Setup.shareable._confirmMultisig(tx, [ users.cbe1, users.cbe2, ])
                assert.isTrue(successfulConfirmation)

                {
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "Error"))[0]
                    assert.isUndefined(event)
                }

                {
                    const event = (await eventsHelper.findEvent([Setup.chronoMint,], lastTx, "RemLOC"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.locName, await contracts.typeHelper.convertToBytes32.call(locInfo.name))
                }
            })

            it(`should not leave any record in LOC manager about deleted "${locInfo.name}" LOC`, async () => {
                const [ 
                    locName, 
                    locWebsite,
                    locIssued,
                    locIssueLimit,
                    locPublishedHash,
                    locExpiredDate,
                    locStatus,
                    locSecurity,
                    locCurrency,
                    locCreationDate,
                ] = await Setup.chronoMint.getLOCByName.call(locInfo.name)

                assert.equal(locWebsite, await contracts.typeHelper.convertToBytes32.call(""))
                assert.equal(locIssued.toNumber(), 0)
                assert.equal(locIssueLimit.toNumber(), 0)
                assert.equal(locPublishedHash, await contracts.typeHelper.convertToBytes32.call(""))
                assert.equal(locExpiredDate.toNumber(), 0)
                assert.equal(locStatus.toNumber(), 0)
                assert.equal(locSecurity.toNumber(), 10)
                assert.equal(locCurrency, await contracts.typeHelper.convertToBytes32.call(""))
                assert.equal(locCreationDate.toNumber(), 0)
            })

            it(`loc manager should not have old "${locInfo.name}" LOC in the list of LOC names`, async () => {
                assert.notInclude(await Setup.chronoMint.getLOCNames.call(), await contracts.typeHelper.convertToBytes32.call(locInfo.name))
            })
        })
    })
})
