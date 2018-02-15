pragma solidity ^0.4.11;

import "../core/user/UserManagerInterface.sol";
import "../core/common/BaseManager.sol";
import "../core/lib/SafeMath.sol";
import "./PendingManagerEmitter.sol";


/// @title PendingManager
///
/// TODO:
contract PendingManager is PendingManagerEmitter, BaseManager {

    using SafeMath for uint;

    uint constant ERROR_PENDING_NOT_FOUND = 4000;
    uint constant ERROR_PENDING_INVALID_INVOCATION = 4001;
    uint constant ERROR_PENDING_ADD_CONTRACT = 4002;
    uint constant ERROR_PENDING_DUPLICATE_TX = 4003;
    uint constant ERROR_PENDING_CANNOT_CONFIRM = 4004;
    uint constant ERROR_PENDING_PREVIOUSLY_CONFIRMED = 4005;

    struct Transaction {
        uint yetNeeded;
        uint ownersDone;
        uint timestamp;
        address to;
        bytes data;
    }

    uint txHashesCount;
    mapping (uint => bytes32) index2hashMapping;
    mapping (bytes32 => uint) hash2indexMapping;
    mapping (bytes32 => Transaction) txBodies;

    function PendingManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
    }

    // METHODS

    function init(address _contractsManager) onlyContractOwner public returns (uint errorCode) {
        BaseManager.init(_contractsManager, "PendingManager");
        return OK;
    }

    function pendingsCount() public view returns (uint) {
        return txHashesCount;
    }

    function getTxs() public view returns (bytes32[] _hashes, uint[] _yetNeeded, uint[] _ownersDone, uint[] _timestamp) {
        uint _txHashesCount = txHashesCount;
        if (_txHashesCount == 0) {
            return;
        }

        _hashes = new bytes32[](_txHashesCount);
        _yetNeeded = new uint[](_txHashesCount);
        _ownersDone = new uint[](_txHashesCount);
        _timestamp = new uint[](_txHashesCount);
        for (uint _idx = 1; _idx <= _txHashesCount; ++_idx) {
            bytes32 _hash = index2hashMapping[_idx];
            Transaction storage _tx = txBodies[_hash];

            _hashes[_idx] = _hash;
            _yetNeeded[_idx] = _tx.yetNeeded;
            _ownersDone[_idx] = _tx.ownersDone;
            _timestamp[_idx] = _tx.timestamp;
        }
    }

    function getTx(bytes32 _hash) public view returns (bytes _data, uint _yetNeeded, uint _ownersDone, uint _timestamp) {
        Transaction storage _tx = txBodies[_hash];
        (_data, _yetNeeded, _ownersDone, _timestamp) = (_tx.data, _tx.yetNeeded, _tx.ownersDone, _tx.timestamp);
    }

    function pendingYetNeeded(bytes32 _hash) public view returns (uint) {
        return txBodies[_hash].yetNeeded;
    }

    function getTxData(bytes32 _hash) public view returns (bytes) {
        return txBodies[_hash].data;
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

        if (hash2indexMapping[_hash] != 0) {
            return _emitError(ERROR_PENDING_DUPLICATE_TX);
        }

        address userManager = getUserManager();
        uint _idx = txHashesCount + 1;
        txBodies[_hash] = Transaction(UserManagerInterface(userManager).required(), 0, now, _to, _data);
        index2hashMapping[_idx] = _hash;
        hash2indexMapping[_hash] = _idx;
        txHashesCount = _idx;

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

        address _to = txBodies[_hash].to;
        if (_to == 0x0) {
            return ERROR_PENDING_NOT_FOUND;
        }

        /* NOTE: https://github.com/paritytech/parity/issues/6982
        https://github.com/aragon/aragonOS/issues/141

        Here should be noted that gas estimation for call and delegatecall invocations
        might be broken and underestimates a gas amount needed to complete a transaction.
        */
        if (!_to.call(txBodies[_hash].data)) {
            revert(); // ERROR_PENDING_CANNOT_CONFIRM
        }

        deleteTx(_hash);
        return OK;
    }

    // revokes a prior confirmation of the given operation
    function revoke(bytes32 _hash) external onlyAuthorized returns (uint errorCode) {
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(msg.sender);
        Transaction storage _tx = txBodies[_hash];
        uint _ownersDone = _tx.ownersDone;
        if ((_ownersDone & ownerIndexBit) == 0) {
            errorCode = _emitError(ERROR_PENDING_NOT_FOUND);
            return errorCode;
        }

        uint _yetNeeded = _tx.yetNeeded + 1;
        _tx.yetNeeded = _yetNeeded;
        _tx.ownersDone = _ownersDone.sub(ownerIndexBit);
        _emitRevoke(msg.sender, _hash);
        if (_yetNeeded == UserManagerInterface(userManager).required()) {
            deleteTx(_hash);
            _emitCancelled(_hash);
        }

        errorCode = OK;
    }

    function hasConfirmed(bytes32 _hash, address _owner) onlyAuthorizedContract(_owner) public view returns (bool) {
        // determine the bit to set for this owner
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(_owner);
        return (txBodies[_hash].ownersDone & ownerIndexBit) != 0;
    }


    // INTERNAL METHODS

    function confirmAndCheck(bytes32 _hash, address _sender) internal onlyAuthorizedContract(_sender) returns (uint) {
        // determine the bit to set for this owner
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(_sender);
        // make sure we (the message sender) haven't confirmed this operation previously
        Transaction storage _tx = txBodies[_hash];
        uint _ownersDone = _tx.ownersDone;
        if ((_ownersDone & ownerIndexBit) != 0) {
            return ERROR_PENDING_PREVIOUSLY_CONFIRMED;
        }

        uint _yetNeeded = _tx.yetNeeded;
        // ok - check if count is enough to go ahead
        if (_yetNeeded <= 1) {
            // enough confirmations: reset and run interior
            _emitDone(_hash, _tx.data, now);
            return OK;
        } else {
            // not enough: record that this owner in particular confirmed
            _tx.yetNeeded = _yetNeeded.sub(1);
            _ownersDone |= ownerIndexBit;
            _tx.ownersDone = _ownersDone;
            _emitConfirmation(_sender, _hash);
            return MULTISIG_ADDED;
        }
    }

    function deleteTx(bytes32 _hash) internal {
        uint _idx = hash2indexMapping[_hash];
        uint _lastHashIdx = txHashesCount;
        bytes32 _lastHash = index2hashMapping[_lastHashIdx];

        if (_idx != _lastHashIdx) {
            delete hash2indexMapping[_hash];
            delete index2hashMapping[_lastHashIdx];
            hash2indexMapping[_lastHash] = _idx;
            index2hashMapping[_idx] = _lastHash;
        } else {
            delete hash2indexMapping[_lastHash];
            delete index2hashMapping[_lastHashIdx];
        }

        delete txBodies[_hash];
        txHashesCount = _lastHashIdx.sub(1);
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
