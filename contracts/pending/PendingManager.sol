pragma solidity ^0.4.11;

import "../core/user/UserManagerInterface.sol";
import "../core/common/BaseManager.sol";
import "./PendingManagerEmitter.sol";


/// @title PendingManager
///
/// TODO:
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

    function PendingManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        txHashes.init('txHashesh');
        to.init('to');
        value.init('value');
        yetNeeded.init('yetNeeded');
        ownersDone.init('ownersDone');
        timestamp.init('timestamp');
    }

    // METHODS

    function init(address _contractsManager) onlyContractOwner public returns (uint errorCode) {
        BaseManager.init(_contractsManager, "PendingManager");
        return OK;
    }

    function pendingsCount() public view returns (uint) {
        return store.count(txHashes);
    }

    function getTxs() public view returns (bytes32[] _hashes, uint[] _yetNeeded, uint[] _ownersDone, uint[] _timestamp) {
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

    function getTx(bytes32 _hash) public view returns (bytes _data, uint _yetNeeded, uint _ownersDone, uint _timestamp) {
        return (data[_hash], store.get(yetNeeded, _hash), store.get(ownersDone, _hash), store.get(timestamp, _hash));
    }

    function pendingYetNeeded(bytes32 _hash) public view returns (uint) {
        return store.get(yetNeeded, _hash);
    }

    function getTxData(bytes32 _hash) public view returns (bytes) {
        return data[_hash];
    }

    function getUserManager() public view returns (address) {
        return lookupManager("UserManager");
    }

    function addTx(bytes32 _hash, bytes _data, address _to, address _sender) onlyAuthorizedContract(_sender) public returns (uint errorCode) {
        /* NOTE: Multiple instances of the same contract could use the same multisig
        implementation based on a single PendingManager contract, so methods with
        the same signature and passed paramenters couldn't be differentiated and would be
        stored in PendingManager under the same key for an instance that were invoked first.

        We add block.number as a salt to make them distinct from each other.
        */
        _hash = keccak256(block.number, _hash);
        
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

    function hasConfirmed(bytes32 _hash, address _owner) onlyAuthorizedContract(_owner) public view returns (bool) {
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
        store.set(to, _hash, 0x0);
        store.set(value, _hash, 0);
        store.set(yetNeeded, _hash, 0);
        store.set(ownersDone, _hash, 0);
        store.set(timestamp, _hash, 0);
        delete data[_hash];

        store.remove(txHashes, _hash);
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

    function () public payable {
        revert();
    }
}
