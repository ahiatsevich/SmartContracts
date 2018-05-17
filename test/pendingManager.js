const MultiEventsHistory = artifacts.require('MultiEventsHistory')
const PendingManager = artifacts.require("PendingManager")
const Stub = artifacts.require("Stub")

const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const TimeMachine = require('./helpers/timemachine')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const glogger = require('./helpers/gasLogger')
const ErrorsScope = require("../common/errors")


contract('Pending Manager', accounts => {
    const timeMachine = new TimeMachine(web3)

    const cbeUser = accounts[0]
    const owner = cbeUser
    const owner1 = accounts[1]
    const owner2 = accounts[2]
    const owner3 = accounts[3]
    const owner4 = accounts[4]
    const owner5 = accounts[5]
    const nonOwner = accounts[6]
    let conf_sign
    let conf_sign2

    const users = {
        cbeUser: accounts[0],
        owner: accounts[0],
        owner1: accounts[1],
        owner2: accounts[2],
        owner3: accounts[3],
        owner4: accounts[4],
        owner5: accounts[5],
        cbeUser1: accounts[7],
        nonOwner: accounts[6],
    }

    const contracts = {}

    before('setup', async () => {
        await Setup.setupPromise()
        glogger.setScope("PendingManager")

        contracts.stubContract = await Stub.deployed()
    })

    after("save logs", async () => {
        if (process.env.NODE_ENV === glogger.WORK_ENV) {
            await glogger.saveOnce(glogger.toJSON())
        }
    })

    context("check setup where", () => {
        it('should receive the right ContractsManager contract address after init() call', async () => {
            assert.equal(await Setup.shareable.contractsManager.call(), Setup.contractsManager.address)
        })

        it("contractsManager should provide PendingManager address", async () =>  {
            assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.PendingManager), Setup.shareable.address)
        })

        it("should show owner as a CBE key", async () =>  {
            assert.isTrue(await Setup.userManager.getCBE.call(users.owner))
        })

        it("should not show owner1 as a CBE key", async () =>  {
            assert.isFalse(await Setup.userManager.getCBE.call(users.owner1))
        })
    
        it("should show 'required' == 0", async () => {
            assert.equal((await Setup.userManager.required.call()).toNumber(), 0)
        })
    })

    context("add more CBEs (with multisig)", () => {
        it("shouldn't allow non-CBE to add another CBE with MULTISIG_ADDED code", async () => {
            assert.equal((await Setup.userManager.addCBE.call(users.owner1, "0x007", { from: users.owner1, })).toNumber(), ErrorsScope.MULTISIG_ADDED)
        })
        
        it("shouldn't allow non-CBE to add another CBE", async () => {
            const tx = await Setup.userManager.addCBE(users.owner1, "0x007", { from: users.owner1, })
            {
                const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "NewUserRegistered"))[0]
                assert.isUndefined(event)
            }
            {
                const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "CBEUpdate"))[0]
                assert.isUndefined(event)
            }
            assert.isFalse(await Setup.userManager.getCBE.call(users.owner1))
    
            await Setup.shareable.cleanUnconfirmedTx()
        })

        it("should allow CBE user to add another CBE with MULTISIG_ADDED code", async () => {
            assert.equal((await Setup.userManager.addCBE.call(users.owner1, "0x007", { from: users.cbeUser, })).toNumber(), ErrorsScope.MULTISIG_ADDED)
        })

        it("should allow CBE user to add another CBE", async () => {
            const tx = await Setup.userManager.addCBE(users.owner1, "0x007", { from: users.cbeUser, })
            {
                const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "NewUserRegistered"))[0]
                assert.isDefined(event)
            }
            {
                const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "CBEUpdate"))[0]
                assert.isDefined(event)
            }
            assert.isTrue(await Setup.userManager.getCBE.call(users.owner1))
    
            await Setup.shareable.cleanUnconfirmedTx()
        })

        const required = 2

        it(`should allow to set required to ${required}`, async () => {
            const tx = await Setup.userManager.setRequired(required, { from: users.cbeUser })
            const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "SetRequired"))[0]
            assert.isDefined(event)
            assert.equal(event.args.required, required)

            assert.equal((await Setup.userManager.required.call()).toNumber(), required)
        })
    })

    context("with 'required' = 2", () => {   
               
        before(async () => {
            const tx = await Setup.userManager.addCBE(users.cbeUser1, "0x101", { from: users.cbeUser, })
            const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
            await Setup.shareable.confirm(event.args.hash, { from: users.owner1, })

            assert.isTrue(await Setup.userManager.getCBE.call(users.cbeUser1))
        })

        after(async () => {
            const tx = await Setup.userManager.revokeCBE(users.cbeUser1, { from: users.cbeUser, })
            const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
            await Setup.shareable.confirm(event.args.hash, { from: users.owner1, })

            assert.isFalse(await Setup.userManager.getCBE.call(users.cbeUser1))
        })

        context("multisig for the same method with salt (required == 2)", () => {
            const tempCBE = accounts[accounts.length - 1]
            let hash1
            let hash2

            var initialPendingsCount

            it("pending operation counter should be 0", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)

                initialPendingsCount = 0
            })

            it("should allow one of CBE to propose other as CBE with multisig", async () => {
                const tx = await Setup.userManager.addCBE(tempCBE, "0x008", { from: owner1 })
                const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                assert.isDefined(event)

                hash1 = event.args.hash
            })

            it("pendings count should incremented by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount + 1)

                initialPendingsCount += 1
            })

            it("should be able to get first pending tx details by hash", async () => {
                const [ txData, txYetNeeded, txOwnersDone, txTimestamp ] = await Setup.shareable.getTx.call(hash1)
                assert.isDefined(txData)
                assert.equal(txYetNeeded.toNumber(), 1)
                assert.notEqual(txOwnersDone, 0)
                assert.notEqual(txTimestamp, 0)
            })

            it("should allow other CBE to propose the same user as CBE with multisig", async () => {
                const tx = await Setup.userManager.addCBE(tempCBE, "0x009", { from: owner })
                const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                assert.isDefined(event)

                hash2 = event.args.hash
                assert.notEqual(hash2, hash1)
            })

            it("pendings count should increment by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount + 1)

                initialPendingsCount += 1
            })

            it("should be able to get second pending tx details by hash", async () => {
                const [ txData, txYetNeeded, txOwnersDone, txTimestamp ] = await Setup.shareable.getTx.call(hash1)
                assert.isDefined(txData)
                assert.equal(txYetNeeded.toNumber(), 1)
                assert.notEqual(txOwnersDone, 0)
                assert.notEqual(txTimestamp, 0)
            })

            it("should be able to get all pending tx details", async () => {
                const [ gtxHashes, ] = await Setup.shareable.getTxs.call()
                assert.lengthOf(gtxHashes, (await Setup.shareable.pendingsCount.call()).toNumber())
                assert.include(gtxHashes, hash1)
                assert.include(gtxHashes, hash2)
            })

            it("should be able to successfully confirm second proposition about the same CBE before the first", async () => {
                const tx = await Setup.shareable.confirm(hash1, { from: owner })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isDefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "NewUserRegistered"))[0]
                    assert.isDefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "SetHash"))[0]
                    assert.isDefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "CBEUpdate"))[0]
                    assert.isDefined(event)
                }
                
                assert.isTrue(await Setup.userManager.getCBE.call(tempCBE))
            })

            it("pendings count should decrement by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount - 1)

                initialPendingsCount -= 1
            })

            it("should be able to successfully confirm second proposition and got `user already is cbe` for the first", async () => {
                const tx = await Setup.shareable.confirm(hash2, { from: owner1 })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isDefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "NewUserRegistered"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "SetHash"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "CBEUpdate"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.userManager,], tx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsScope.USER_ALREADY_CBE)
                }

                assert.isTrue(await Setup.userManager.getCBE.call(tempCBE))
            })

            it("pendings count should decrement by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount - 1)

                initialPendingsCount -= 1
            })

            it('should be able to remove CBE', async () => {
                const revokeTx = await Setup.userManager.revokeCBE(tempCBE, { from: owner, })
                const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], revokeTx, "Confirmation"))[0]

                await Setup.shareable.confirm(confirmationEvent.args.hash, { from: owner1 })

                assert.isFalse(await Setup.userManager.getCBE.call(tempCBE))
            })
        })

        context("add tx for non-authorized sender", () => {
            const hash = "0xfffeeefff"
            let msgData
            
            before(async () => {
                msgData = await contracts.stubContract.performMethod3.call(4, "stub contract", "non-auth sender")
            })

            after(async () => {
                await Setup.shareable.cleanUnconfirmedTx()
            })

            it("pendings count should be 0", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
            })

            it("authorized address should be able to send addTx for unauthorized user with MULTISIG_ADDED code", async () => {
                assert.equal((await Setup.shareable.addTx.call(
                    hash, 
                    msgData, 
                    contracts.stubContract.address, 
                    users.nonOwner, 
                    { from: users.cbeUser, }
                )).toNumber(), ErrorsScope.MULTISIG_ADDED)
            })

            var confirmationHash

            it("authorized address should be able to send addTx for unauthorized user", async () => {
                const tx = await Setup.shareable.addTx(
                    hash, 
                    msgData, 
                    contracts.stubContract.address, 
                    users.nonOwner, 
                    { from: users.cbeUser, }
                )
                
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.owner, users.nonOwner)
                    assert.equal(event.args.sender, users.cbeUser)
                    assert.notEqual(event.args.hash, hash)

                    confirmationHash = event.args.hash
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isUndefined(event)
                }
            })

            it("pendings count should increment by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 1)
            })

            it("tx pending yet needed should show that full required number of confirmation are needed (2)", async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), 2)
            })

            it("one cbe should be able to confirm this tx with MULTISIG_ADDED code", async () => {
                assert.equal((await Setup.shareable.confirm.call(confirmationHash, { from: users.cbeUser, })).toNumber(), ErrorsScope.MULTISIG_ADDED)
            })

            it("one cbe should be able to confirm this tx", async () => {
                const tx = await Setup.shareable.confirm(confirmationHash, { from: users.cbeUser, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.owner, users.cbeUser) /// TODO: should rename from 'owner' to 'sender'
                    assert.equal(event.args.hash, confirmationHash)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isUndefined(event)
                }
            })
            
            it("pending yet needed should show 1 more confirmation needed", async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), 1)
            })

            it("should show that cbe has confirmed this hash", async () => {
                assert.isTrue(await Setup.shareable.hasConfirmed.call(confirmationHash, users.cbeUser))
            })

            it("the same cbe should not be able to confirm twice with PENDING_PREVIOUSLY_CONFIRMED code", async () => {
                assert.equal((await Setup.shareable.confirm.call(confirmationHash, { from: users.cbeUser, })).toNumber(), ErrorsScope.PENDING_PREVIOUSLY_CONFIRMED)
            })

            it("the same cbe should not be able to confirm twice", async () => {
                const tx = await Setup.shareable.confirm(confirmationHash, { from: users.cbeUser, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isUndefined(event)
                }
            })

            it("pending yet needed should not change and show 1 needed confirmation", async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), 1)
            })

            it("pendings count should not change", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 1)
            })
            
            it("other cbe should be able to confirm this tx with OK code", async () => {
                assert.equal((await Setup.shareable.confirm.call(confirmationHash, { from: users.owner1, })).toNumber(), ErrorsScope.OK)
            })
            
            it("other cbe should be able to confirm this tx", async () => {
                const tx = await Setup.shareable.confirm(confirmationHash, { from: users.owner1, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.hash, confirmationHash)
                    // assert.equal(event.args.data, msgData)
                    assert.notEqual(event.args.timestamp, 0)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Cancelled"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.hash, confirmationHash)
                }
                {
                    const event = (await eventsHelper.findEvent([contracts.stubContract,], tx, "MethodInvoked"))[0]
                    assert.isDefined(event)
                    // assert.equal(event.args.msgData, msgData)
                    assert.equal(event.args.sender, Setup.shareable.address)
                }
            })

            it("pending yet needed should be 0", async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), 0)
            })

            it("pendings count should decrement by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
            })


            it("should show that cbe has not confirmed this hash because tx was deleted", async () => {
                assert.isFalse(await Setup.shareable.hasConfirmed.call(confirmationHash, users.owner1))
            })

            it("should show that the first cbe has not confirmed this hash because tx was deleted", async () => {
                assert.isFalse(await Setup.shareable.hasConfirmed.call(confirmationHash, users.cbeUser))
            })

            it("third cbe should not be able to confirm this tx with PENDING_NOT_FOUND code", async () => {
                assert.equal((await Setup.shareable.confirm.call(confirmationHash, { from: users.cbeUser1, })).toNumber(), ErrorsScope.PENDING_NOT_FOUND)
            })

            it("third cbe should not be able to confirm this tx", async () => {
                const tx = await Setup.shareable.confirm(confirmationHash, { from: users.cbeUser1, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Cancelled"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "MethodInvoked"))[0]
                    assert.isUndefined(event)
                }
            })

            it("pendings count should be 0", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
            })
        })

        context("add tx for authorized sender", () => {
            const hash = "0xfffeeefff"
            let msgData
            
            before(async () => {
                msgData = await contracts.stubContract.performMethod3.call(4, "stub contract", "non-auth sender")
            })

            after(async () => {
                await Setup.shareable.cleanUnconfirmedTx()
            })

            it("pendings count should be 0", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
            })

            it("authorized address should be able to send addTx for authorized user with MULTISIG_ADDED code", async () => {
                assert.equal((await Setup.shareable.addTx.call(
                    hash, 
                    msgData, 
                    contracts.stubContract.address, 
                    users.cbeUser, 
                    { from: users.cbeUser, }
                )).toNumber(), ErrorsScope.MULTISIG_ADDED)
            })

            it("authorized address should be able to send addTx for authorized user", async () => {
                const tx = await Setup.shareable.addTx(
                    hash, 
                    msgData, 
                    contracts.stubContract.address, 
                    users.cbeUser, 
                    { from: users.cbeUser, }
                )
                
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.owner, users.cbeUser)
                    assert.notEqual(event.args.hash, hash)
                    
                    confirmationHash = event.args.hash
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isUndefined(event)
                }
            })

            it("pendings count should increment by 1", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 1)
            })

            it("tx pending yet should show that 1 confirmation are needed", async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), 1)
            })
            
            it("other cbe should be able to confirm this tx with OK code", async () => {
                assert.equal((await Setup.shareable.confirm.call(confirmationHash, { from: users.owner1, })).toNumber(), ErrorsScope.OK)
            })
            
            it("other cbe should be able to confirm this tx", async () => {
                const tx = await Setup.shareable.confirm(confirmationHash, { from: users.owner1, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Done"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.hash, confirmationHash)
                    // assert.equal(event.args.data, msgData)
                    assert.notEqual(event.args.timestamp, 0)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Cancelled"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.hash, confirmationHash)
                }
                {
                    const event = (await eventsHelper.findEvent([contracts.stubContract,], tx, "MethodInvoked"))[0]
                    assert.isDefined(event)
                    // assert.equal(event.args.msgData, msgData)
                    assert.equal(event.args.sender, Setup.shareable.address)
                }
            })

            it("pendings count should be 0", async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
            })
        })

        context("revoke of not existed tx", () => {
            const initialPendingsCount = 3
            const hash = "0xfffeeefff"
            const confirmationHashes = []
            let msgData
            
            before(async () => {
                msgData = await contracts.stubContract.performMethod3.call(4, "stub contract", "non-auth sender")
                
                for (var _idx = 0; _idx < initialPendingsCount; ++_idx) {
                    const tx = await Setup.shareable.addTx(hash, msgData, contracts.stubContract.address, users.cbeUser, { from: users.cbeUser, })
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Confirmation"))[0]
                    confirmationHashes.push(event.args.hash)
                }
            })

            after(async () => {
                for (var confirmationHash of confirmationHashes) {
                    if (await Setup.shareable.hasConfirmed.call(confirmationHash, users.cbeUser)) {
                        console.log(`### confirmed ${confirmationHash} for ${users.cbeUser}`);
                        
                        await Setup.shareable.revoke(confirmationHash, { from: users.cbeUser, })
                    }
                }
            })

            it(`pendings count should be equal to ${initialPendingsCount}`, async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount)
            })

            it("all txs should require only 1 more confirmation needed", async () => {
                for (var confirmationHash of confirmationHashes) {
                    assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHash)).toNumber(), 1)
                }
            })

            const tryTxIdx = 1

            it("non-cbe should not be able to revoke tx with UNAUTHORIZED code", async () => {
                assert.equal((await Setup.shareable.revoke.call(confirmationHashes[tryTxIdx], { from: users.nonOwner, })).toNumber(), ErrorsScope.UNAUTHORIZED)
            })

            it("non-cbe should not be able to revoke tx", async () => {
                const tx = await Setup.shareable.revoke(confirmationHashes[tryTxIdx], { from: users.nonOwner, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Revoke"))[0]
                    assert.isUndefined(event)
                }
            })

            it(`pendings count still should be equal to ${initialPendingsCount}`, async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount)
            })

            it(`should show that other cbe has not confirmed yet this hash`, async () => {
                assert.isFalse(await Setup.shareable.hasConfirmed.call(confirmationHashes[tryTxIdx], users.owner1))
            })

            it("not voted cbe should not be able to revoke tx with PENDING_NOT_FOUND code", async () => {
                assert.equal((await Setup.shareable.revoke.call(confirmationHashes[tryTxIdx], { from: users.owner1, })).toNumber(), ErrorsScope.PENDING_NOT_FOUND)
            })

            it("not voted cbe should not be able to revoke tx", async () => {
                const tx = await Setup.shareable.revoke(confirmationHashes[tryTxIdx], { from: users.owner1, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Revoke"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Cancelled"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsScope.PENDING_NOT_FOUND)
                }
            })

            it(`pendings count still should be equal to ${initialPendingsCount}`, async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount)
            })

            it("tx pending yet should show that 1 confirmation are needed", async () => {
                assert.equal((await Setup.shareable.pendingYetNeeded.call(confirmationHashes[tryTxIdx])).toNumber(), 1)
            })

            it("should show that cbe has confirmed this hash", async () => {
                assert.isTrue(await Setup.shareable.hasConfirmed.call(confirmationHashes[tryTxIdx], users.cbeUser))
            })

            it("cbe should be able to revoke tx with OK code", async () => {
                assert.equal((await Setup.shareable.revoke.call(confirmationHashes[tryTxIdx], { from: users.cbeUser, })).toNumber(), ErrorsScope.OK)
            })

            it("cbe should be able to revoke tx", async () => {
                const tx = await Setup.shareable.revoke(confirmationHashes[tryTxIdx], { from: users.cbeUser, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Revoke"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.owner, users.cbeUser)
                    assert.equal(event.args.hash, confirmationHashes[tryTxIdx])
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Cancelled"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.hash, confirmationHashes[tryTxIdx])
                }
                {
                    const event = (await eventsHelper.findEvent([contracts.stubContract,], tx, "MethodInvoked"))[0]
                    assert.isUndefined(event)
                }
            })

            var pendingsCountLeft

            it(`pendings count still should be equal to ${initialPendingsCount - 1}`, async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), initialPendingsCount - 1)

                pendingsCountLeft = initialPendingsCount - 1
            })

            it("cbe should not be able to revoke already finalized tx with PENDING_NOT_FOUND code", async () => {
                assert.equal((await Setup.shareable.revoke.call(confirmationHashes[tryTxIdx], { from: users.cbeUser, })).toNumber(), ErrorsScope.PENDING_NOT_FOUND)
            })

            it("cbe should not be able to revoke already finalized tx", async () => {
                const tx = await Setup.shareable.revoke(confirmationHashes[tryTxIdx], { from: users.cbeUser, })
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Revoke"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Cancelled"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([contracts.stubContract,], tx, "MethodInvoked"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsScope.PENDING_NOT_FOUND)
                }
            })

            it(`pendings count still should be equal to ${initialPendingsCount - 1}`, async () => {
                assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), pendingsCountLeft)
            })

            it(`every semi-confirmed txs should have correct info`, async () => {
                for (var confirmationHash of confirmationHashes) {
                    if (confirmationHash === confirmationHashes[tryTxIdx]) {
                        continue;
                    }

                    const [ txData, txYetNeeded, txOwnersDone, ] = await Setup.shareable.getTx.call(confirmationHash)
                    assert.notEqual(txData, "")
                    assert.notEqual(txYetNeeded, 0)
                    assert.notEqual(txOwnersDone, 0)
                    assert.isTrue(await Setup.shareable.hasConfirmed.call(confirmationHash, users.cbeUser))
                }
            })

            it("every semi-confirmed txs should be confirmed by cbe", async () => {
                for (var confirmationHash of confirmationHashes) {
                    if (confirmationHash === confirmationHashes[tryTxIdx]) {
                        continue;
                    }
                    assert.isTrue(await Setup.shareable.hasConfirmed.call(confirmationHash, users.cbeUser))
                }
            })
        })
    })

    context("goint to increment 'required' to 3", () => {

        it("shows owner as a CBE key", async () =>  {
            assert.isTrue(await Setup.chronoMint.isAuthorized.call(owner))
        })

        it("shows owner1 as a CBE key", async () =>  {
            assert.isTrue(await Setup.chronoMint.isAuthorized.call(owner1))
        })

        it("doesn't show owner2 as a CBE key", async () =>  {
            assert.isFalse(await Setup.chronoMint.isAuthorized.call(owner2))
        })

        it("pending operation counter should be 0", async () =>  {
            assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
        })

        it("allows to propose pending operation and revoke it", async () => {
            await glogger.makeSlice("propose pending for adding CBE, required == 2, then revoke", async (slice) => {
                let addCbeTx = await Setup.userManager.addCBE(owner2, 0x0, { from:owner })
                slice.addMethod("userManager.addCBE", addCbeTx)

                let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                conf_sign = confirmationEvent.args.hash

                const afterAddCbePendingsCount = await Setup.shareable.pendingsCount.call()
                assert.equal(afterAddCbePendingsCount, 1)

                const revokeTx = await Setup.shareable.revoke(conf_sign, { from: owner })
                slice.addMethod("shareable.revoke", revokeTx)

                let revokeEvent = (await eventsHelper.findEvent([Setup.shareable], revokeTx, "Revoke"))[0]
                assert.isDefined(revokeEvent)
                assert.equal(revokeEvent.args.hash, conf_sign)

                let isAuthorized = await Setup.chronoMint.isAuthorized.call(owner2)
                assert.isFalse(isAuthorized)

                const afterRevokePendingsCount = await Setup.shareable.pendingsCount.call()
                assert.equal(afterRevokePendingsCount, 0)
            })
        })

        it("allows one CBE key to add another CBE key", async () => {
            await glogger.makeSlice("propose pending for adding CBE, required == 2, then confirm", async (slice) => {
                let addCbeTx = await Setup.userManager.addCBE(owner2, 0x0, { from: owner })
                slice.addMethod("userManager.addCBE", addCbeTx)

                let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                conf_sign = confirmationEvent.args.hash

                let confirmCbeTx = await Setup.shareable.confirm(conf_sign, { from: owner1 })
                slice.addMethod("shareable.confirm", confirmCbeTx)

                let doneEvent = (await eventsHelper.findEvent([Setup.shareable], confirmCbeTx, "Done"))[0]
                assert.isDefined(doneEvent)
                assert.equal(doneEvent.args.hash, conf_sign)
            })

            let isAuthorized = await Setup.chronoMint.isAuthorized.call(owner2)
            assert.isTrue(isAuthorized)
        })

        it("pending operation counter should be 0", async () =>  {
            assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
        })

        it("should allow set 'required' == 3", async () =>  {
            const nextRequired = 3
            let requiredTx = await Setup.userManager.setRequired(nextRequired, { from: owner })
            let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], requiredTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            conf_sign = confirmationEvent.args.hash

            await Setup.shareable.confirm(conf_sign, { from: owner1 })
            assert.equal(await Setup.userManager.required.call(), nextRequired)
        })

    })

    context("going to increment 'required' to 4", () => {

        it("allows 2 votes for the new key to grant authorization.", async () => {
            await glogger.makeSlice("propose pending for adding CBE, required == 3, then confirm", async (slice) => {
                let addCbeTx = await Setup.userManager.addCBE(owner3, 0x0, { from: owner2 })
                slice.addMethod("userManager.addCBE", addCbeTx)

                let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                conf_sign = confirmationEvent.args.hash

                let confirm1CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner })
                slice.addMethod("shareable.confirm", confirm1CbeTx)

                let confirm2CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner1 })
                slice.addMethod("shareable.confirm", confirm2CbeTx)

                let doneEvent = (await eventsHelper.findEvent([Setup.shareable], confirm2CbeTx, "Done"))[0]
                assert.isDefined(doneEvent)
                assert.equal(doneEvent.args.hash, conf_sign)
            })

            let isAuthorized = await Setup.chronoMint.isAuthorized.call(owner3)
            assert.isTrue(isAuthorized)
        })

        it("pending operation counter should be 0", async () =>  {
            assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
        })

        it("should allow set 'required' == 4", async () =>  {
            const nextRequired = 4
            let requiredTx = await Setup.userManager.setRequired(nextRequired, { from: owner })
            let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], requiredTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            conf_sign = confirmationEvent.args.hash

            await Setup.shareable.confirm(conf_sign, { from: owner1 })
            await Setup.shareable.confirm(conf_sign, { from: owner2 })
            assert.equal(await Setup.userManager.required.call(), nextRequired)
        })

    })

    context("going to increment 'required' to 5", () => {

        it("allows 3 votes for the new key to grant authorization", async () => {
            await glogger.makeSlice("propose pending for adding CBE, required == 4, then confirm", async (slice) => {
                let addCbeTx = await Setup.userManager.addCBE(owner4, 0x0, { from: owner2 })
                slice.addMethod("userManager.addCBE", addCbeTx)

                let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                conf_sign = confirmationEvent.args.hash

                let confirm1CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner })
                slice.addMethod("shareable.confirm", confirm1CbeTx)

                let confirm2CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner1 })
                slice.addMethod("shareable.confirm", confirm2CbeTx)

                let confirm3CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner3 })
                slice.addMethod("shareable.confirm", confirm3CbeTx)

                let doneEvent = (await eventsHelper.findEvent([Setup.shareable], confirm3CbeTx, "Done"))[0]
                assert.isDefined(doneEvent)
                assert.equal(doneEvent.args.hash, conf_sign)
            })

            let isAuthorized = await Setup.chronoMint.isAuthorized.call(owner4)
            assert.isTrue(isAuthorized)
        })

        it("pending operation counter should be 0", async () =>  {
            assert.equal((await Setup.shareable.pendingsCount.call()).toNumber(), 0)
        })
        
        const nextRequired = 5

        it(`should allow set 'required' == ${nextRequired}`, async () =>  {
            let tx = await Setup.userManager.setRequired(nextRequired, { from: owner })
            let event = (await eventsHelper.findEvent([Setup.shareable], tx, "Confirmation"))[0]
            assert.isDefined(event)

            conf_sign = event.args.hash

            await Setup.shareable.confirm(conf_sign, { from: owner1 })
            await Setup.shareable.confirm(conf_sign, { from: owner2 })
            await Setup.shareable.confirm(conf_sign, { from: owner3 })
            assert.equal(await Setup.userManager.required.call(), nextRequired)
        })
    })

    context("going to increment 'required' to 6", () => {
        it("collects 4 vote to addCBE and granting auth.", async () => {
            await glogger.makeSlice("propose pending for adding CBE, required == 5, then confirm", async (slice) => {
                let addCbeTx = await Setup.userManager.addCBE(owner5, 0x0, { from: owner2 })
                slice.addMethod("userManager.addCBE", addCbeTx)

                let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                conf_sign = confirmationEvent.args.hash

                let confirm1CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner })
                slice.addMethod("shareable.confirm", confirm1CbeTx)

                let confirm2CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner1 })
                slice.addMethod("shareable.confirm", confirm2CbeTx)

                let confirm3CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner3 })
                slice.addMethod("shareable.confirm", confirm3CbeTx)

                let confirm4CbeTx = await Setup.shareable.confirm(conf_sign, { from: owner4 })
                slice.addMethod("shareable.confirm", confirm4CbeTx)

                let doneEvent = (await eventsHelper.findEvent([Setup.shareable], confirm4CbeTx, "Done"))[0]
                assert.isDefined(doneEvent)
                assert.equal(doneEvent.args.hash, conf_sign)
            })

            let isAuthorized = await Setup.chronoMint.isAuthorized.call(owner5)
            assert.isTrue(isAuthorized)
        })

        it("can show all members", async () => {
            let [ members, ] = await Setup.userManager.getCBEMembers.call()
            assert.isAtLeast(members.length, 5)
            // console.log(`members ${JSON.stringify(members, null, 4)}`);
            const owners = [ owner, owner1, owner2 ]
            owners.forEach((user) => assert.include(members, user))

        })

        it("required signers should be 6", async () => {
            const nextRequired = 6
            let requiredTx = await Setup.userManager.setRequired(nextRequired, { from: owner })
            let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], requiredTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            conf_sign = confirmationEvent.args.hash

            await Setup.shareable.confirm(conf_sign, { from: owner1 })
            await Setup.shareable.confirm(conf_sign, { from: owner2 })
            await Setup.shareable.confirm(conf_sign, { from: owner3 })
            await Setup.shareable.confirm(conf_sign, { from: owner4 })
            assert.equal(await Setup.userManager.required.call(), nextRequired)
        })


        it("pending operation counter should be 0", async () => {
            assert.equal(await Setup.shareable.pendingsCount.call(), 0)
        })


        it("allows a CBE to propose revocation of an authorized key", async () => {
            let revokeTx = await Setup.userManager.revokeCBE(owner5, { from: owner })
            let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], revokeTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            conf_sign2 = confirmationEvent.args.hash

            assert.isOk(await Setup.userManager.isAuthorized.call(owner5))
        })

        it("check confirmation yet needed should be 5", async () => {
            assert.equal(await Setup.shareable.pendingYetNeeded.call(conf_sign2), 5)
        })

        it("should increment pending operation counter ", async () => {
            assert.equal(await Setup.shareable.pendingsCount.call(), 1)
        })

        it("allows 5 CBE member vote for the revocation to revoke authorization.", async () => {
            await Setup.shareable.confirm(conf_sign2, { from: owner1 })
            await Setup.shareable.confirm(conf_sign2, { from: owner2 })
            await Setup.shareable.confirm(conf_sign2, { from: owner3 })
            await Setup.shareable.confirm(conf_sign2, { from: owner4 })
            await Setup.shareable.confirm(conf_sign2, { from: owner5 })

            assert.isNotOk(await Setup.chronoMint.isAuthorized.call(owner5))
        })

        it("required signers should be 5", async () => {
            assert.equal(await Setup.userManager.required.call(), 5)
        })

        it("should decrement pending operation counter ", async () => {
            assert.equal(await Setup.shareable.pendingsCount.call(), 0)
        })
    })
})
