const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const glogger = require('./helpers/gasLogger')
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol')
const PendingManager = artifacts.require("./PendingManager.sol")

contract('Pending Manager', function(accounts) {
    let owner = accounts[0]
    let owner1 = accounts[1]
    let owner2 = accounts[2]
    let owner3 = accounts[3]
    let owner4 = accounts[4]
    let owner5 = accounts[5]
    let nonOwner = accounts[6]
    let conf_sign
    let conf_sign2

    before('setup', async () => {
        await Setup.setupPromise()
        glogger.setScope("PendingManager")
    })

    after("save logs", async () => {
        if (process.env.NODE_ENV === glogger.WORK_ENV) {
            await glogger.saveOnce(glogger.toJSON())
        }
    })

    context("with one CBE key", async () => {

        it('should receive the right ContractsManager contract address after init() call', async () => {
            assert.equal(await Setup.shareable.contractsManager.call(), Setup.contractsManager.address)
        })

        it("can provide PendingManager address.", async () =>  {
            assert.equal(await Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.PendingManager), Setup.shareable.address)
        })

        it("shows owner as a CBE key.", async () =>  {
            assert.isOk(await Setup.chronoMint.isAuthorized.call(owner))
        })

        it("doesn't show owner1 as a CBE key.", async () =>  {
            assert.isNotOk(await Setup.chronoMint.isAuthorized.call(owner1))
        })

        it("doesn't allows non CBE key to add another CBE key.", async () =>  {
            await Setup.userManager.addCBE(owner1, 0x0, { from: owner1 })
            assert.isNotOk(await Setup.userManager.isAuthorized.call(owner1))
        })

        it("shouldn't allow setRequired signatures 2.", async () =>  {
            await Setup.userManager.setRequired(2)
            assert.equal(await Setup.userManager.required.call(), 0)
        })

        it("allows one CBE key to add another CBE key.", async () => {
            await glogger.makeSlice('add one CBE key when required == 1, confirm immediately', async (slice) => {
                const tx = await Setup.userManager.addCBE(owner1, 0x0, { from: owner })
                slice.addMethod("userManager.addCBE", tx)
            })

            const isAuthorized = await Setup.userManager.isAuthorized.call(owner1)
            assert.isTrue(isAuthorized)
        })

        it("should allow setRequired signatures 2.", async () => {
            const required = 2

            await Setup.userManager.setRequired(required, { from: owner })

            const updatedRequired = await Setup.userManager.required.call()
            assert.equal(updatedRequired, required)
        })

        context("multisig for the same method with salt (required CBE == 2)", async () => {
            const tempCBE = accounts[accounts.length - 1]
            let hash1
            let hash2

            it("pending operation counter should be 0", async () => {
                assert.equal(await Setup.shareable.pendingsCount.call(), 0)
            })

            it("should allow one of CBE to propose other as CBE with multisig", async () => {
                const addCbeTx = await Setup.userManager.addCBE(tempCBE, 0x0, { from: owner1 })
                const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                hash1 = confirmationEvent.args.hash
                assert.equal(await Setup.shareable.pendingsCount.call(), 1)
            })

            it("should allow other CBE to propose the same user as CBE with multisig", async () => {
                const addCbeTx = await Setup.userManager.addCBE(tempCBE, 0x0, { from: owner })
                const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
                assert.isDefined(confirmationEvent)

                hash2 = confirmationEvent.args.hash
                assert.notEqual(hash2, hash1)
                assert.equal(await Setup.shareable.pendingsCount.call(), 2)
            })

            it("should be able to successfully confirm second proposition and got `user already is cbe` for the first", async () => {
                const conf1Tx = await Setup.shareable.confirm(hash1, { from: owner })
                const doneConf1Event = (await eventsHelper.findEvent([Setup.shareable, Setup.userManager], conf1Tx, "Done"))[0]

                assert.isDefined(doneConf1Event)
                assert.isTrue(await Setup.userManager.getCBE.call(tempCBE))
                assert.equal(await Setup.shareable.pendingsCount.call(), 1)

                const conf2Tx = await Setup.shareable.confirm(hash2, { from: owner1 })
                const doneConf2Event = (await eventsHelper.findEvent([Setup.shareable, Setup.userManager], conf2Tx, "Done"))[0]

                assert.isDefined(doneConf2Event)
                assert.isTrue(await Setup.userManager.getCBE.call(tempCBE))
                assert.equal(await Setup.shareable.pendingsCount.call(), 0)
            })

            it('should be able to remove CBE', async () => {
                const revokeTx = await Setup.userManager.revokeCBE(tempCBE, { from: owner})
                const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], revokeTx, "Confirmation"))[0]

                await Setup.shareable.confirm(confirmationEvent.args.hash, { from: owner1 })

                assert.isFalse(await Setup.userManager.getCBE.call(tempCBE))
            })
        })
    })

    context("with two CBE keys", async () => {

        it("shows owner as a CBE key.", async () =>  {
            assert.isOk(await Setup.chronoMint.isAuthorized.call(owner))
        })

        it("shows owner1 as a CBE key.", async () =>  {
            assert.isOk(await Setup.chronoMint.isAuthorized.call(owner1))
        })

        it("doesn't show owner2 as a CBE key.", async () =>  {
            assert.isNotOk(await Setup.chronoMint.isAuthorized.call(owner2))
        })

        it("pending operation counter should be 0", async () =>  {
            assert.equal(await Setup.shareable.pendingsCount.call(), 0)
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
            assert.equal(await Setup.shareable.pendingsCount.call(), 0)
        })

        it("should allow setRequired signatures 3.", async () =>  {
            const nextRequired = 3
            let requiredTx = await Setup.userManager.setRequired(nextRequired, { from: owner })
            let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], requiredTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            conf_sign = confirmationEvent.args.hash

            await Setup.shareable.confirm(conf_sign, { from: owner1 })
            assert.equal(await Setup.userManager.required.call(), nextRequired)
        })

    })

    context("with three CBE keys", async () => {

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
            assert.equal(await Setup.shareable.pendingsCount.call(), 0)
        })

        it("should allow set required signers to be 4", async () =>  {
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

    context("with four CBE keys", async () => {

        it("allows 3 votes for the new key to grant authorization.", async () => {
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
            return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
                assert.equal(r, 0)
            })
        })

        it("should allow set required signers to be 5", async () =>  {
            const nextRequired = 5
            let requiredTx = await Setup.userManager.setRequired(nextRequired, { from: owner })
            let confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], requiredTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            conf_sign = confirmationEvent.args.hash

            await Setup.shareable.confirm(conf_sign, { from: owner1 })
            await Setup.shareable.confirm(conf_sign, { from: owner2 })
            await Setup.shareable.confirm(conf_sign, { from: owner3 })
            assert.equal(await Setup.userManager.required.call(), nextRequired)
        })
    })

    context("with five CBE keys", async () => {
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
            assert.isAtLeast(members.length, 3)
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
