pragma solidity ^0.4.11;

import "../core/user/UserManagerInterface.sol";
import "../core/common/BaseManager.sol";
import "./PendingManagerEmitter.sol";

contract PendingManager is PendingManagerEmitter, BaseManager {

    uint constant ERROR_PENDING_NOT_FOUND = 4000;
    uint constant ERROR_PENDING_INVALID_INVOCATION = 4001;
    uint constant ERROR_PENDING_ADD_CONTRACT = 4002;
    uint constant ERROR_PENDING_DUPLICATE_TX = 4003;
    uint constant ERROR_PENDING_CANNOT_CONFIRM = 4004;
    uint constant ERROR_PENDING_PREVIOUSLY_CONFIRMED = 4005;

    // TYPES
    StorageInterface.Set txHashes;
    StorageInterface.Bytes32AddressMapping to;
    StorageInterface.Bytes32UIntMapping value;
    StorageInterface.Bytes32UIntMapping yetNeeded;
    StorageInterface.Bytes32UIntMapping ownersDone;
    StorageInterface.Bytes32UIntMapping timestamp;

    mapping (bytes32 => bytes) data;

    function PendingManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) {
        txHashes.init('txHashesh');
        to.init('to');
        value.init('value');
        yetNeeded.init('yetNeeded');
        ownersDone.init('ownersDone');
        timestamp.init('timestamp');
    }

    // METHODS

    function init(address _contractsManager) onlyContractOwner returns (uint errorCode) {
        BaseManager.init(_contractsManager, "PendingManager");
        return OK;
    }

    function pendingsCount() constant returns (uint) {
        return store.count(txHashes);
    }

    function getTxs() constant returns (bytes32[] _hashes, uint[] _yetNeeded, uint[] _ownersDone, uint[] _timestamp) {
        _hashes = new bytes32[](pendingsCount());
        _yetNeeded = new uint[](pendingsCount());
        _ownersDone = new uint[](pendingsCount());
        _timestamp = new uint[](pendingsCount());
        for (uint i = 0; i < pendingsCount(); i++) {
            _hashes[i] = store.get(txHashes, i);
            _yetNeeded[i] = store.get(yetNeeded, _hashes[i]);
            _ownersDone[i] = store.get(ownersDone, _hashes[i]);
            _timestamp[i] = store.get(timestamp, _hashes[i]);
        }
        return (_hashes, _yetNeeded, _ownersDone, _timestamp);
    }

    function getTx(bytes32 _hash) constant returns (bytes _data, uint _yetNeeded, uint _ownersDone, uint _timestamp) {
        return (data[_hash], store.get(yetNeeded, _hash), store.get(ownersDone, _hash), store.get(timestamp, _hash));
    }

    function pendingYetNeeded(bytes32 _hash) constant returns (uint) {
        return store.get(yetNeeded, _hash);
    }

    function getTxData(bytes32 _hash) constant returns (bytes) {
        return data[_hash];
    }

    function getUserManager() constant returns (address) {
        return lookupManager("UserManager");
    }

    function addTx(bytes32 _hash, bytes _data, address _to, address _sender) onlyAuthorizedContract(_sender) returns (uint errorCode) {
        if (store.includes(txHashes, _hash)) {
            return _emitError(ERROR_PENDING_DUPLICATE_TX);
        }

        store.add(txHashes, _hash);
        data[_hash] = _data;
        store.set(to, _hash, _to);
        address userManager = getUserManager();
        store.set(yetNeeded, _hash, UserManagerInterface(userManager).required());
        store.set(timestamp, _hash, now);

        errorCode = conf(_hash, _sender);
        return _checkAndEmitError(errorCode);
    }

    function confirm(bytes32 _hash) external returns (uint) {
        uint errorCode = conf(_hash, msg.sender);
        return _checkAndEmitError(errorCode);
    }

    function conf(bytes32 _hash, address _sender) internal returns (uint errorCode) {
        errorCode = confirmAndCheck(_hash, _sender);
        if (OK != errorCode) {
            return errorCode;
        }

        if (store.get(to, _hash) == 0) {
            return ERROR_PENDING_NOT_FOUND;
        }

        /* NOTE: https://github.com/aragon/aragonOS/issues/141
        Here should be noted that gas estimation for call and delegatecall invocations
        might be broken and underestimates a gas amount needed to complete a transaction.
        */
        if (!store.get(to, _hash).call(data[_hash])) {
            revert(); // ERROR_PENDING_CANNOT_CONFIRM
        }

        deleteTx(_hash);
        return OK;
    }

    // revokes a prior confirmation of the given operation
    function revoke(bytes32 _hash) external onlyAuthorized returns (uint errorCode) {
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(msg.sender);
        if (store.get(ownersDone, _hash) & ownerIndexBit <= 0) {
            errorCode = _emitError(ERROR_PENDING_NOT_FOUND);
            return errorCode;
        }

        store.set(yetNeeded, _hash, store.get(yetNeeded, _hash) + 1);
        store.set(ownersDone, _hash, store.get(ownersDone, _hash) - ownerIndexBit);
        _emitRevoke(msg.sender, _hash);
        if (store.get(yetNeeded, _hash) == UserManagerInterface(userManager).required()) {
            deleteTx(_hash);
            _emitCancelled(_hash);
        }

        errorCode = OK;
    }

    function hasConfirmed(bytes32 _hash, address _owner) onlyAuthorizedContract(_owner) constant returns (bool) {
        // determine the bit to set for this owner
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(_owner);
        return !(store.get(ownersDone, _hash) & ownerIndexBit == 0);
    }


    // INTERNAL METHODS

    function confirmAndCheck(bytes32 _hash, address _sender) internal onlyAuthorizedContract(_sender) returns (uint) {
        // determine the bit to set for this owner
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(_sender);
        // make sure we (the message sender) haven't confirmed this operation previously
        if (store.get(ownersDone, _hash) & ownerIndexBit != 0) {
            return ERROR_PENDING_PREVIOUSLY_CONFIRMED;
        }

        // ok - check if count is enough to go ahead
        if (store.get(yetNeeded, _hash) <= 1) {
            // enough confirmations: reset and run interior
            _emitDone(_hash, data[_hash], now);
            return OK;
        } else {
            // not enough: record that this owner in particular confirmed
            store.set(yetNeeded, _hash, store.get(yetNeeded, _hash) - 1);
            uint _ownersDone = store.get(ownersDone, _hash);
            _ownersDone |= ownerIndexBit;
            store.set(ownersDone, _hash, _ownersDone);
            _emitConfirmation(_sender, _hash);
            return MULTISIG_ADDED;
        }
    }

    function deleteTx(bytes32 _hash) internal {
        uint txId = store.getIndex(txHashes, _hash);
        uint txCount = store.count(txHashes);
        if (txId != txCount - 1) {
            updateTxId(txId, txCount - 1);
        }

        store.remove(txHashes, _hash);
    }

    function updateTxId(uint _oldId, uint _newId) internal {
        store.set(to, store.get(txHashes, _oldId), store.get(to, store.get(txHashes, _newId)));
        store.set(value, store.get(txHashes, _oldId), store.get(value, store.get(txHashes, _newId)));
        store.set(yetNeeded, store.get(txHashes, _oldId), store.get(yetNeeded, store.get(txHashes, _newId)));
        store.set(ownersDone, store.get(txHashes, _oldId), store.get(ownersDone, store.get(txHashes, _newId)));
        store.set(timestamp, store.get(txHashes, _oldId), store.get(timestamp, store.get(txHashes, _newId)));
        data[store.get(txHashes, _oldId)] = data[store.get(txHashes, _newId)];
    }

    function _emitConfirmation(address owner, bytes32 hash) internal {
        PendingManager(getEventsHistory()).emitConfirmation(owner, hash);
    }

    function _emitRevoke(address owner, bytes32 hash) internal {
        PendingManager(getEventsHistory()).emitRevoke(owner, hash);
    }

    function _emitCancelled(bytes32 hash) internal {
        PendingManager(getEventsHistory()).emitCancelled(hash);
    }

    function _emitDone(bytes32 hash, bytes data, uint timestamp) internal {
        PendingManager(getEventsHistory()).emitDone(hash, data, timestamp);
    }

    function _emitError(uint error) internal returns (uint) {
        PendingManager(getEventsHistory()).emitError(error);

        return error;
    }

    function _checkAndEmitError(uint error) internal returns (uint)  {
        if (error != OK && error != MULTISIG_ADDED) {
            return _emitError(error);
        }

        return error;
    }

    function() {
        throw;
    }
}
