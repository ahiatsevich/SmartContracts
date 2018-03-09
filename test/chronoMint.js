const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const Setup = require('../setup/setup')
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol')
const PendingManager = artifacts.require("./PendingManager.sol")
const ErrorsEnum = require("../common/errors")
const ERC20Manager = artifacts.require('./ERC20Manager.sol')
const ERC20Interface = artifacts.require('./ERC20Interface.sol')
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol')
const ChronoBankAssetWithFeeProxy = artifacts.require('./ChronoBankAssetWithFeeProxy.sol')
const ChronoBankAssetWithFee = artifacts.require('./ChronoBankAssetWithFee.sol')
const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')

function tokenContractBySymbol(symbol, contract) {
    return Setup.erc20Manager.getTokenAddressBySymbol.call(symbol)
    .then(_address => contract.at(_address))
}

contract('LOC Manager', function(accounts) {
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
    let unix = Math.round(+new Date()/1000);
    const Status = {maintenance:0,active:1, suspended:2, bankrupt:3};
    const SYMBOL = 'TIME';
    const SYMBOL2 = 'LHT';
    const NAME = 'Time Token';
    const DESCRIPTION = 'ChronoBank Time Shares';
    const NAME2 = 'Labour-hour Token';
    const DESCRIPTION2 = 'ChronoBank Lht Assets';
    const BASE_UNIT = 2;
    const IS_REISSUABLE = true;
    const IS_NOT_REISSUABLE = false;
    const BALANCE_ETH = 1000;
    const fakeArgs = [0,0,0,0,0,0,0,0];

    let getAllPlatformsForUser = async (user) => {
        var userPlatforms = []
        let platformsCount = await Setup.platformsManager.getPlatformsCount.call()
        let allPlatforms = await Setup.platformsManager.getPlatforms.call(0, platformsCount)

        for (var _platformIdx = 0; _platformIdx < allPlatforms.length; ++_platformIdx) {
              const _platformAddr = allPlatforms[_platformIdx];

              let _platform = await ChronoBankPlatform.at(_platformAddr);
              let _owner = await _platform.contractOwner.call();
              if (_owner === user) {
                  userPlatforms.push(_platformAddr);
              }
        }

        return userPlatforms
    }

    before('setup', function(done) {
        PendingManager.at(MultiEventsHistory.address).then((instance) => {
            eventor = instance;
            Setup.setup(done);
        });
    });

    context("with one CBE key", function(){
        it("Platform has correct TIME proxy address.", function() {
            return Setup.chronoBankPlatform.proxies.call(SYMBOL).then(_proxy => {
                return Setup.erc20Manager.getTokenAddressBySymbol.call(SYMBOL).then(_token => {
                    assert.equal(_proxy, _token);
                })
            })
        })

        it("Platform has correct LHT proxy address.", async () => {
            const platformAddresses = await getAllPlatformsForUser(owner)
            assert.isAtLeast(platformAddresses.length, 1)

            const platform = await ChronoBankPlatform.at(platformAddresses[0])
            let gotProxyAddr = await platform.proxies.call(SYMBOL2)

            let registeredProxyAddr = await Setup.erc20Manager.getTokenAddressBySymbol.call(SYMBOL2)

            assert.equal(registeredProxyAddr, gotProxyAddr)
        })

        //
        // it("TIME contract has correct TIME proxy address.", function() {
        //   return Setup.chronoBankAsset.proxy.call().then(function(r) {
        //     assert.equal(r,Setup.chronoBankAssetProxy.address);
        //   });
        // });
        //
        // it("LHT contract has correct LHT proxy address.", function() {
        //   return Setup.chronoBankAssetWithFee.proxy.call().then(function(r) {
        //     assert.equal(r,Setup.chronoBankAssetWithFeeProxy.address);
        //   });
        // });

        // it("TIME proxy has right version", function() {
        //   return Setup.chronoBankAssetProxy.getLatestVersion.call().then(function(r) {
        //     assert.equal(r,Setup.chronoBankAsset.address);
        //   });
        // });
        //
        // it("LHT proxy has right version", function() {
        //   return Setup.chronoBankAssetWithFeeProxy.getLatestVersion.call().then(function(r) {
        //     assert.equal(r,Setup.chronoBankAssetWithFee.address);
        //   });
        // });

        it("can provide ChronoMint address.", function() {
            return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.LOCManager).then(function(r) {
                assert.equal(r,Setup.chronoMint.address);
            });
        });

        it("can provide UserManager address.", function() {
            return Setup.contractsManager.getContractAddressByType.call(Setup.contractTypes.UserManager).then(function(r) {
                assert.equal(r,Setup.userManager.address);
            });
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

        it("checks CBE counter is 1.", function() {
            return Setup.userManager.adminCount.call().then(function(r) {
                assert.equal(r,1);
            });
        });

        it("doesn't show owner1 as a CBE key.", function() {
            return Setup.chronoMint.isAuthorized.call(owner1).then(function(r) {
                assert.isNotOk(r);
            });
        });

        it("pending operation counter should be 0", function() {
            return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
                assert.equal(r, 0);
            });
        });

        it("doesn't allows non CBE to propose an LOC.", function() {
            return Setup.chronoMint.addLOC.call(
                bytes32("Bob's Hard Workers"),
                bytes32("www.ru"),
                1000,
                bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                unix,
                SYMBOL2, {from:owner1}
            ).then(function(r){
                return Setup.chronoMint.addLOC(
                    bytes32("Bob's Hard Workers"),
                    bytes32("www.ru"),
                    1000,
                    bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                    unix,
                    SYMBOL2,{
                        from: owner1,
                        gas: 3000000
                    }
                ).then(function(){
                    assert.equal(r,ErrorsEnum.UNAUTHORIZED);
                });
            });
        });

        it("allows a CBE to propose an LOC.", function() {
            return Setup.chronoMint.addLOC.call(
                bytes32("Bob's Hard Workers"),
                bytes32("www.ru"),
                1000,
                bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                unix,
                SYMBOL2
            ).then(function(r){
                return Setup.chronoMint.addLOC(
                    bytes32("Bob's Hard Workers"),
                    bytes32("www.ru"),
                    1000,
                    bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                    unix,
                    SYMBOL2,{
                        from: accounts[0],
                        gas: 3000000
                    }
                ).then(function(){
                    return Setup.chronoMint.getLOCById.call(0).then(function(r2){
                        assert.equal(r, ErrorsEnum.OK)
                        assert.equal(r2[6], Status.maintenance);
                    });
                });
            });
        });

        it("doesn't allows a non CBE to change LOC data.", function() {
            return Setup.chronoMint.setLOC.call(
                bytes32("Bob's Hard Workers"),
                bytes32("David's Hard Workers"),
                bytes32("www.ru"),
                1000,
                bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                unix, {from:owner1}
            ).then(function(r){
                return Setup.chronoMint.setLOC(
                    bytes32("Bob's Hard Workers"),
                    bytes32("David's Hard Workers"),
                    bytes32("www.ru"),
                    1000,
                    bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                    unix,{
                        from: owner1,
                        gas: 3000000
                    }
                ).then(function(){
                    return Setup.chronoMint.getLOCById.call(0).then(function(r){
                        assert.equal(r[0], bytes32("Bob's Hard Workers"));
                    });
                });
            });
        });

        it("allows a CBE to change LOC data.", function() {
            return Setup.chronoMint.setLOC.call(
                bytes32("Bob's Hard Workers"),
                bytes32("David's Hard Workers"),
                bytes32("www.ru"),
                1000,
                bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                unix, {from:owner}
            ).then(function(r){
                return Setup.chronoMint.setLOC(
                    bytes32("Bob's Hard Workers"),
                    bytes32("David's Hard Workers"),
                    bytes32("www.ru"),
                    1000,
                    bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                    unix,{
                        from: owner,
                        gas: 3000000
                    }
                ).then(function(){
                    return Setup.chronoMint.getLOCById.call(0).then(function(r){
                        assert.equal(r[0], bytes32("David's Hard Workers"));
                    });
                });
            });
        });

        it("doesn't allows non CBE to change LOC status.", function() {
            return Setup.chronoMint.setStatus.call(bytes32("David's Hard Workers"), Status.active, {from:owner1}).then(function(r){
                return Setup.chronoMint.setStatus(bytes32("David's Hard Workers"), Status.active, {from:owner1}).then(function(){
                    return Setup.chronoMint.getLOCById.call(0).then(function(r2) {
                        assert.equal(r, ErrorsEnum.UNAUTHORIZED);
                        assert.equal(r2[6], Status.maintenance);
                    });
                });
            });
        });

        it("allows a CBE to change LOC status.", function() {
            return Setup.chronoMint.setStatus(bytes32("David's Hard Workers"), Status.active, {from:owner}).then(function(){
                return Setup.chronoMint.getLOCById.call(0).then(function(r2){
                    assert.equal(r2[6], Status.active);
                });
            });
        });

        it("Proposed LOC should increment LOCs counter", function() {
            return Setup.chronoMint.getLOCCount.call().then(function(r){
                assert.equal(r, 1);
            });
        });

        it("doesn't allow CBE member to remove LOC is loc is active", function() {
            return Setup.chronoMint.removeLOC(bytes32("David's Hard Workers"),{
                from: owner,
                gas: 3000000
            }).then(function() {
                return Setup.chronoMint.getLOCCount.call().then(function(r){
                    assert.equal(r, 1);
                });
            });
        });

        it("allows a CBE to change LOC status.", function() {
            return Setup.chronoMint.setStatus(bytes32("David's Hard Workers"), Status.maintenance, {from:owner}).then(function(){
                return Setup.chronoMint.getLOCById.call(0).then(function(r2){
                    assert.equal(r2[6], Status.maintenance);
                });
            });
        });

        it("allow CBE member to remove LOC is loc is not active", function() {
            return Setup.chronoMint.removeLOC(bytes32("David's Hard Workers"),{
                from: owner,
                gas: 3000000
            }).then(function() {
                return Setup.chronoMint.getLOCCount.call().then(function(r){
                    assert.equal(r, 0);
                });
            });
        });

        it("pending operation counter should be 0", function() {
            return Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
                assert.equal(r, 0);
            });
        });

        it("allows one CBE key to add another CBE key.", function() {
            return Setup.userManager.addCBE(owner1,0x2).then(function() {
                return Setup.userManager.isAuthorized.call(owner1).then(function(r){
                    assert.isOk(r);
                });
            });
        });

        it("checks CBE counter is 2.", function() {
            return Setup.userManager.adminCount.call().then(function(r) {
                assert.equal(r,2);
            });
        });

        it("should allow setRequired signatures 2.", function() {
            return Setup.userManager.setRequired(2).then(function() {
                return Setup.userManager.required.call({from: owner}).then(function(r) {
                    assert.equal(r, 2);
                });
            });
        });

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
            return Setup.userManager.addCBE(owner2, 0x2, {from:owner}).then(function(txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                Setup.shareable.pendingsCount.call({from: owner}).then(function(r) {
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
            return Setup.userManager.addCBE(owner2, 0x1, {from:owner}).then(function(txHash) {
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
            return Setup.userManager.addCBE(owner3, 0x1, {from: owner2}).then(function(txHash) {
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
            return Setup.userManager.addCBE(owner4, 0x1, {from: owner3}).then(function(txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign,{from:owner}).then(function() {
                    return Setup.shareable.confirm(conf_sign,{from:owner1}).then(function() {
                        return Setup.shareable.confirm(conf_sign,{from:owner2}).then(function() {
                            //  return shareable.confirm(conf_sign,{from:owner3}).then(function() {
                            return Setup.chronoMint.isAuthorized.call(owner3).then(function(r){
                                assert.isOk(r);
                            });
                            //    });
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
            return Setup.userManager.addCBE(owner5, 0x1, {from: owner4}).then(function (txHash) {
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

        it("allows a CBE to propose an LOC.", function () {
            return Setup.chronoMint.addLOC(
                bytes32("Bob's Hard Workers"),
                bytes32("www.ru"),
                1000000,
                bytes32fromBase58("QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB"),
                unix,
                SYMBOL2
            ).then(function (r) {
                return Setup.chronoMint.getLOCById.call(0).then(function (r) {
                    assert.equal(r[0], bytes32("Bob's Hard Workers"));
                    assert.equal(r[6], Status.maintenance);
                });
            });
        });

        it("Proposed LOC should increment LOCs counter", function () {
            return Setup.chronoMint.getLOCCount.call().then(function (r) {
                assert.equal(r, 1);
            });
        });

        it("ChronoMint should be able to return LOCs array with proposed LOC name", function () {
            return Setup.chronoMint.getLOCNames.call().then(function (r) {
                assert.equal(r[0], bytes32("Bob's Hard Workers"));
            });
        });


        it("allows 5 CBE members to activate an LOC.", function () {
            return Setup.chronoMint.setStatus(bytes32("Bob's Hard Workers"), Status.active, {from: owner}).then(function (txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function (r) {
                    return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function (r) {
                        return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function (r) {
                            return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function (r) {
                                return Setup.shareable.confirm(conf_sign, {from: owner5}).then(function (r) {
                                    return Setup.chronoMint.getLOCById.call(0).then(function (r) {
                                        assert.equal(r[6], Status.active);
                                    });
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

        it("should decrement pending operation counter ", function () {
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

        it("should show 0 LHT balance", function () {
            return Setup.erc20Manager.getTokenAddressBySymbol.call(SYMBOL2)
            .then(_tokenAddress => ERC20Interface.at(_tokenAddress))
            .then(_token => _token.balanceOf.call(accounts[0]))
            .then(_balance => {
                assert.equal(_balance, 0);
            })
        });

        it("should show LOC issue limit", function () {
            return Setup.chronoMint.getLOCById.call(0).then(function (r) {
                assert.equal(r[3], 1000000);
            });
        });

        it("shouldn't be abble to Issue 1100000 LHT for LOC according to issueLimit", function () {
            return Setup.chronoMint.reissueAsset(1100000, bytes32("Bob's Hard Workers"), {
                from: owner,
                gas: 3000000
            }).then((txHash) => {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function () {
                    return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
                        return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
                            return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
                                return Setup.shareable.confirm(conf_sign, {from: owner5}).then(function () {
                                    return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                                        return _assetWithFeeProxy.balanceOf.call(Setup.chronoMintWallet.address).then(function (r2) {
                                            assert.equal(r2, 0);
                                        });
                                    })
                                });
                            });
                        });
                    });
                });
            });
        });

        it("should have LOCManager as an owner of LHT asset", function () {
            return Setup.assetsManager.isAssetOwner.call(SYMBOL2, Setup.chronoMintWallet.address).then(_isOwner => {
                assert.isOk(_isOwner)
            })
        })

        it("should be abble to Issue 1000000 LHT for LOC according to issueLimit", function () {
            return Setup.chronoMint.reissueAsset(1000000, bytes32("Bob's Hard Workers"), {
                from: owner,
                gas: 3000000
            }).then(function (txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function () {
                    return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
                        return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
                            return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
                                return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                                    return _assetWithFeeProxy.balanceOf.call(Setup.chronoMintWallet.address).then(function (r2) {
                                        assert.equal(r2, 1000000);
                                    })
                                });
                            });
                        });
                    })
                });
            });
        });

        it("shouldn't be abble to Issue 1000 LHT for LOC according to issued and issueLimit", function () {
            return Setup.chronoMint.reissueAsset(1000, bytes32("Bob's Hard Workers"), {
                from: owner,
                gas: 3000000
            }).then(function (txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function () {
                    return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
                        return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
                            return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
                                return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                                    return _assetWithFeeProxy.balanceOf.call(Setup.chronoMintWallet.address).then(function (r2) {
                                        assert.equal(r2, 1000000);
                                    })
                                });
                            });
                        });
                    })
                });
            });
        });

        it("shouldn't increment pending operation counter ", function () {
            return Setup.shareable.pendingsCount.call({from: owner}).then(function (r) {
                assert.equal(r, 0);
            });
        });

        it("should show LOC issued 1000000", function () {
            return Setup.chronoMint.getLOCById.call(0).then(function (r) {
                assert.equal(r[2], 1000000);
            });
        });

        it("should be abble to Revoke 500000 LHT for LOC according to issueLimit", function () {
            return Setup.chronoMint.revokeAsset(500000, bytes32("Bob's Hard Workers"), {
                from: owner,
                gas: 3000000
            }).then(function (txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function () {
                    return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
                        return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
                            return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
                                return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                                    return _assetWithFeeProxy.balanceOf.call(Setup.chronoMintWallet.address).then(function (r2) {
                                        assert.equal(r2, 500000);
                                    })
                                });
                            });
                        });
                    })
                });
            });
        });

        it("should show LOC issued 500000", function () {
            return Setup.chronoMint.getLOCById.call(0).then(function (r) {
                assert.equal(r[2], 500000);
            });
        });

        it("should be able to send 500000 LHT to owner to produce some fees", function () {
            return Setup.chronoMint.sendAsset(SYMBOL2, owner2, 495049, {
                from: owner,
                gas: 3000000
            }).then(function (txHash) {
                return eventsHelper.getEvents(txHash, watcher);
            }).then(function(events) {
                conf_sign = events[0].args.hash;
                return Setup.shareable.confirm(conf_sign, {from: owner4}).then(function () {
                    return Setup.shareable.confirm(conf_sign, {from: owner1}).then(function () {
                        return Setup.shareable.confirm(conf_sign, {from: owner2}).then(function () {
                            return Setup.shareable.confirm(conf_sign, {from: owner3}).then(function () {
                                return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy)
                                .then(_assetWithFeeProxy => {
                                    return _assetWithFeeProxy.balanceOf.call(owner2).then(function (r2) {
                                        assert.equal(r2, 495049);
                                    })
                                });
                            });
                        });
                    });
                });
            });
        });

        it("should show 1% of transferred to exchange 500000 on rewards contract balance", function () {
            return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                return _assetWithFeeProxy.getLatestVersion.call().then(_address => ChronoBankAssetWithFee.at(_address))
                .then(_assetWithFee => {
                    return _assetWithFee.feeAddress.call()
                    .then(_feeAddress => assert.equal(_feeAddress, Setup.rewardsWallet.address))
                })
                .then(() => {
                    return _assetWithFeeProxy.balanceOf.call(Setup.rewardsWallet.address).then(function (r2) {
                        assert.equal(r2, 4951);
                    })
                })
            });
        });

        it("should be able to send 100 TIME to owner", function () {
            let currentOwner = owner1
            return Setup.erc20Manager.getTokenAddressBySymbol.call(SYMBOL).then(_tokenAddress => {
                assert.notEqual(_tokenAddress, 0)

                return ERC20Interface.at(_tokenAddress)
            })
            .then(_token => {
                return _token.balanceOf.call(owner)
                .then(() => _token.transfer.call(owner1, 100, { from: owner }))
                .then(_transferResult => {
                    return _token.transfer(owner1, 100, { from: owner }).then(() => {
                        assert.isOk(_transferResult)
                    })
                })
            })
        });

        it("check Owner has 100 TIME", function () {
            return tokenContractBySymbol(SYMBOL, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                return _assetWithFeeProxy.balanceOf.call(owner1).then(function (r2) {
                    assert.equal(r2, 100);
                })
            })
        })

        it("owner should be able to approve 100 TIME to TimeHolder", function () {
            let currentOwner = owner1
            return Setup.timeHolder.wallet.call().then(_walletAddress => {
                return tokenContractBySymbol(SYMBOL, ChronoBankAssetProxy).then(_assetProxy => {
                    return _assetProxy.approve.call(_walletAddress, 100, {from: currentOwner}).then((r) => {
                        return _assetProxy.approve(_walletAddress, 100, {from: currentOwner}).then(() => {
                            assert.isOk(r);
                        })
                    })
                })
            })
        });

        it("should be able to deposit 100 TIME from owner", async () => {
            let currentOwner = owner1
            let timeAddress = await Setup.erc20Manager.getTokenAddressBySymbol(SYMBOL);
            let depositTx = await Setup.timeHolder.depositFor(timeAddress, currentOwner, 100, { from: currentOwner })
            let balance = await Setup.timeHolder.getDepositBalance(timeAddress, currentOwner, { from: currentOwner })

            assert.equal(balance, 100);
        })

        it("should show 100 TIME for currnet rewards period", function () {
            return Setup.rewards.totalDepositInPeriod.call(0).then((r) => {
                assert.equal(r, 100);
            })
        })

        it("should return periods length = 1", function () {
            return Setup.rewards.periodsLength.call().then((r) => {
                assert.equal(r, 0);
            })
        })

        it("should be able to close rewards period and destribute rewards", function() {
            let currentOwner = owner1
            return Setup.rewards.closePeriod({from: owner}).then(() => {
                return Setup.rewards.depositBalanceInPeriod.call(currentOwner, 0, {from: currentOwner}).then((r1) => {
                    return Setup.rewards.totalDepositInPeriod.call(0, {from: currentOwner}).then((r2) => {
                        return tokenContractBySymbol(SYMBOL2, ChronoBankAssetWithFeeProxy).then(_assetWithFeeProxy => {
                            return Setup.rewards.rewardsFor.call(_assetWithFeeProxy.address, currentOwner).then((r3) => {
                                return Setup.rewards.withdrawReward(_assetWithFeeProxy.address, r3, { from: currentOwner }).then(() => {
                                    return _assetWithFeeProxy.balanceOf.call(currentOwner).then((r4) => {
                                        assert.equal(r1, 100);
                                        assert.equal(r2, 100);
                                        assert.equal(r3, 4951); //issue reward + exchage sell + exchange buy
                                        assert.equal(r4, 4951);
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })

        /*   it("should be able to TIME exchange rate from Bittrex", function() {
        return rateTracker.rate.call().then((r) => {
        assert.notEqual(r,null)
    })
})*/


});
});
