const Setup = require('../setup/setup')
const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol')
const PendingManager = artifacts.require("./PendingManager.sol")

contract('Pending Manager', function(accounts) {
  let owner = accounts[0];
  let owner1 = accounts[1];
  let owner2 = accounts[2];
  let owner3 = accounts[3];
  let owner4 = accounts[4];
  let owner5 = accounts[5];
  let nonOwner = accounts[6];
  let conf_sign;
  let conf_sign2;
  let conf_sign3;
  let txId;
  let watcher;
  let eventor;

  before('setup', function(done) {
    PendingManager.at(MultiEventsHistory.address).then((instance) => {
      eventor = instance;
      Setup.setup(done);
    });
  });

  context("with one CBE key", function(){

    it('should receive the right ContractsManager contract address after init() call', () => {
      return Setup.shareable.contractsManager.call()
        .then((address) => assert.equal(address, Setup.contractsManager.address));
    });

    it("can provide PendingManager address.", function() {
      return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.PendingManager).then(function(r) {
        assert.equal(r,Setup.shareable.address);
      });
    });

    it("shows owner as a CBE key.", function() {
      return Setup.chronoMint.isAuthorized.call(owner).then(function(r) {
        assert.isOk(r);
      });
    });

    it("doesn't show owner1 as a CBE key.", function() {
      return Setup.chronoMint.isAuthorized.call(owner1).then(function(r) {
        assert.isNotOk(r);
      });
    });

    it("doesn't allows non CBE key to add another CBE key.", function() {
      return Setup.userManager.addCBE(owner1,0x0,{from:owner1}).then(function() {
        return Setup.userManager.isAuthorized.call(owner1).then(function(r){
          assert.isNotOk(r);
        });
      });
    });

    it("shouldn't allow setRequired signatures 2.", function() {
      return Setup.userManager.setRequired(2).then(function() {
        return Setup.userManager.required.call({from: owner}).then(function(r) {
          assert.equal(r, 0);
        });
      });
    });

    it("allows one CBE key to add another CBE key.", function() {
      return Setup.userManager.addCBE(owner1,0x0).then(function() {
        return Setup.userManager.isAuthorized.call(owner1).then(function(r){
          assert.isOk(r);
        });
      });
    });

    it("should allow setRequired signatures 2.", function() {
      return Setup.userManager.setRequired(2).then(function() {
        return Setup.userManager.required.call({from: owner}).then(function(r) {
          assert.equal(r, 2);
        });
      });
    });

    context("multisig for the same method with salt (required CBE == 2)", function () {
        const tempCBE = accounts[accounts.length - 1]
        let hash1
        let hash2

        it("pending operation counter should be 0", async () => {
            const pendingOperationNumber = await Setup.shareable.pendingsCount.call({from: owner})
            assert.equal(pendingOperationNumber, 0)
        })

        it("should allow one of CBE to propose other as CBE with multisig", async () => {
            const addCbeTx = await Setup.userManager.addCBE(tempCBE, 0x0, { from: owner1 })
            const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            hash1 = confirmationEvent.args.hash

            const pendingOperationNumber = await Setup.shareable.pendingsCount.call()
            assert.equal(pendingOperationNumber, 1)
        })

        it("should allow other CBE to propose the same user as CBE with multisig", async () => {
            const addCbeTx = await Setup.userManager.addCBE(tempCBE, 0x0, { from: owner })
            const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], addCbeTx, "Confirmation"))[0]
            assert.isDefined(confirmationEvent)

            hash2 = confirmationEvent.args.hash
            assert.notEqual(hash2, hash1)

            const pendingOperationNumber = await Setup.shareable.pendingsCount.call()
            assert.equal(pendingOperationNumber, 2)
        })

        it("should be able to successfully confirm second proposition and got `user already is cbe` for the first", async () => {
            const conf1Tx = await Setup.shareable.confirm(hash1, { from: owner })
            const doneConf1Event = (await eventsHelper.findEvent([Setup.shareable, Setup.userManager], conf1Tx, "Done"))[0]
            assert.isDefined(doneConf1Event)

            assert.isTrue(await Setup.userManager.getCBE.call(tempCBE))

            const pendingOperationNumber = await Setup.shareable.pendingsCount.call()
            assert.equal(pendingOperationNumber, 1)

            const conf2Tx = await Setup.shareable.confirm(hash2, { from: owner1 })
            const doneConf2Event = (await eventsHelper.findEvent([Setup.shareable, Setup.userManager], conf2Tx, "Done"))[0]
            assert.isDefined(doneConf2Event)

            assert.isTrue(await Setup.userManager.getCBE.call(tempCBE))

            const nextPendingOperationNumber = await Setup.shareable.pendingsCount.call()
            assert.equal(nextPendingOperationNumber.toNumber(), 0)
        })

        it('should be able to remove CBE', async () => {
            const revokeTx = await Setup.userManager.revokeCBE(tempCBE, { from: owner})
            const confirmationEvent = (await eventsHelper.findEvent([Setup.shareable], revokeTx, "Confirmation"))[0]
            await Setup.shareable.confirm(confirmationEvent.args.hash, { from: owner1 })

            assert.isFalse(await Setup.userManager.getCBE.call(tempCBE))
        })
    })
  });

  context("with two CBE keys", function(){

    it("shows owner as a CBE key.", function() {
      return Setup.chronoMint.isAuthorized.call(owner).then(function(r) {
        assert.isOk(r);
      });
    });

    it("shows owner1 as a CBE key.", function() {
      return Setup.chronoMint.isAuthorized.call(owner1).then(function(r) {
        assert.isOk(r);
      });
    });

    it("doesn't show owner2 as a CBE key.", function() {
      return Setup.chronoMint.isAuthorized.call(owner2).then(function(r) {
        assert.isNotOk(r);
      });
    });

    it("pending operation counter should be 0", function() {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
        assert.equal(r, 0);
      });
    });

    it("allows to propose pending operation", function() {
      eventsHelper.setupEvents(eventor);
      watcher = eventor.Confirmation();
      return Setup.userManager.addCBE(owner2, 0x0, {from:owner}).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
          assert.equal(r,1);
        });
      });
    });

    it("allows to revoke last confirmation and remove pending operation", function() {
      return Setup.shareable.revoke(conf_sign, {from:owner}).then(function() {
        Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
          assert.equal(r,0);
        });
      });
    });

    it("allows one CBE key to add another CBE key", function() {
      return Setup.userManager.addCBE(owner2, 0x0, {from:owner}).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign, {from:owner1}).then(function() {
          return Setup.chronoMint.isAuthorized.call(owner2).then(function(r){
            assert.isOk(r);
          });
        });
      });
    });

    it("pending operation counter should be 0", function() {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
        assert.equal(r, 0);
      });
    });

    it("should allow setRequired signatures 3.", function() {
      return Setup.userManager.setRequired(3).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign,{from:owner1}).then(function() {
          return Setup.userManager.required.call({from: owner}).then(function(r) {
            assert.equal(r, 3);
          });
        });
      });
    });

  });

  context("with three CBE keys", function(){

    it("allows 2 votes for the new key to grant authorization.", function() {
      return Setup.userManager.addCBE(owner3, 0x0, {from: owner2}).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign,{from:owner}).then(function() {
          return Setup.shareable.confirm(conf_sign,{from:owner1}).then(function() {
            return Setup.chronoMint.isAuthorized.call(owner3).then(function(r){
              assert.isOk(r);
            });
          });
        });
      });
    });

    it("pending operation counter should be 0", function() {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
        assert.equal(r, 0);
      });
    });

    it("should allow set required signers to be 4", function() {
      return Setup.userManager.setRequired(4).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign,{from:owner1}).then(function() {
          return Setup.shareable.confirm(conf_sign,{from:owner2}).then(function() {
            return Setup.userManager.required.call({from: owner}).then(function(r) {
              assert.equal(r, 4);
            });
          });
        });
      });
    });

  });

  context("with four CBE keys", function(){

    it("allows 3 votes for the new key to grant authorization.", function() {
      return Setup.userManager.addCBE(owner4, 0x0, {from: owner3}).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign,{from:owner}).then(function() {
          return Setup.shareable.confirm(conf_sign,{from:owner1}).then(function() {
            return Setup.shareable.confirm(conf_sign,{from:owner2}).then(function() {
              return Setup.chronoMint.isAuthorized.call(owner3).then(function(r){
                assert.isOk(r);
              });
            });
          });
        });
      });
    });

    it("pending operation counter should be 0", function() {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
        assert.equal(r, 0);
      });
    });

    it("should allow set required signers to be 5", function() {
      return Setup.userManager.setRequired(5).then(function(txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign,{from:owner1}).then(function() {
          return Setup.shareable.confirm(conf_sign,{from:owner2}).then(function() {
            return Setup.shareable.confirm(conf_sign,{from:owner3}).then(function() {
              return Setup.userManager.required.call({from: owner}).then(function(r2) {
                assert.equal(r2, 5);
              });
            });
          });
        });
      });
    });

  });

  context("with five CBE keys", function() {
    it("collects 4 vote to addCBE and granting auth.", function () {
      return Setup.userManager.addCBE(owner5, 0x0, {from: owner4}).then(function (txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign, {from: owner}).then(function () {
          return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
            return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
              return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
                return Setup.chronoMint.isAuthorized.call(owner5).then(function (r) {
                  assert.isOk(r);
                });
              });
            });
          });
        });
      });
    });

    it("can show all members", function () {
      return Setup.userManager.getCBEMembers.call().then(function (r) {
        assert.equal(r[0][0], owner);
        assert.equal(r[0][1], owner1);
        assert.equal(r[0][2], owner2);
      });
    });

    it("required signers should be 6", function () {
      return Setup.userManager.setRequired(6).then(function (txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign = events[0].args.hash;
        return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
          return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
            return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
              return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function () {
                return Setup.userManager.required.call({from: owner}).then(function (r) {
                  assert.equal(r, 6);
                });
              });
            });
          });
        });
      });
    });


    it("pending operation counter should be 0", function () {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function (r) {
        assert.equal(r, 0);
      });
    });


    it("allows a CBE to propose revocation of an authorized key.", function () {
      return Setup.userManager.revokeCBE(owner5, {from: owner}).then(function (txHash) {
        return eventsHelper.getEvents(txHash, watcher);
      }).then(function(events) {
        conf_sign2 = events[0].args.hash;
        return Setup.userManager.isAuthorized.call(owner5).then(function (r) {
          assert.isOk(r);
        });
      });
    });

    it("check confirmation yet needed should be 5", function () {
      return Setup.shareable.pendingYetNeeded.call(conf_sign2).then(function (r) {
        assert.equal(r, 5);
      });
    });

    it("should increment pending operation counter ", function () {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function (r) {
        assert.equal(r, 1);
      });
    });

    it("allows 5 CBE member vote for the revocation to revoke authorization.", function () {
      return Setup.shareable.confirm(conf_sign2, {from: owner1}).then(function () {
        return Setup.shareable.confirm(conf_sign2, {from: owner2}).then(function () {
          return Setup.shareable.confirm(conf_sign2, {from: owner3}).then(function () {
            return Setup.shareable.confirm(conf_sign2, {from: owner4}).then(function () {
              return Setup.shareable.confirm(conf_sign2, {from: owner5}).then(function () {
                return Setup.chronoMint.isAuthorized.call(owner5).then(function (r) {
                  assert.isNotOk(r);
                });
              });
            });
          });
        });
      });
    });

    it("required signers should be 5", function () {
      return Setup.userManager.required.call({from: owner}).then(function (r) {
        assert.equal(r, 5);
      });
    });

    it("should decrement pending operation counter ", function () {
      return Setup.shareable.pendingsCount.call({from: owner}).then(function (r) {
        assert.equal(r, 0);
      });
    });

  });
});
