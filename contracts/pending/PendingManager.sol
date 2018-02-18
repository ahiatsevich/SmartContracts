pragma solidity ^0.4.11;

import "../core/user/UserManagerInterface.sol";
import "../core/common/BaseManager.sol";
import "../core/lib/SafeMath.sol";
import "./PendingManagerEmitter.sol";
import '../core/event/MultiEventsHistory.sol';

/// @title PendingManager
///
/// Contract provides a way to control multisignature for transactions and perform them after collecting
/// a required amount of confirmations. Allows to track transactions that are already in pending queue.
/// Uses UserManager contrant for managing access to contract's functions.
contract PendingManager is PendingManagerEmitter, BaseManager {

    using SafeMath for uint;

    /* Constants */

    uint constant ERROR_PENDING_NOT_FOUND = 4000;
    uint constant ERROR_PENDING_INVALID_INVOCATION = 4001;
    uint constant ERROR_PENDING_ADD_CONTRACT = 4002;
    uint constant ERROR_PENDING_DUPLICATE_TX = 4003;
    uint constant ERROR_PENDING_CANNOT_CONFIRM = 4004;
    uint constant ERROR_PENDING_PREVIOUSLY_CONFIRMED = 4005;

    /// @title Defines a structure for a transaction record
    struct Transaction {
        /// @dev yetNeeded number of required confirmations to accept and carry out a tx
        uint yetNeeded;
        /// @dev ownersDone bitmask; contais indices of users that have confirmed a tx
        uint ownersDone;
        /// @dev timestamp time when a tx were added
        uint timestamp;
        /// @dev to a recepient of a tx; it will be used as a source for tx
        address to;
        /// @dev data a data of tx
        bytes data;
    }

    /// @dev number of pending txs
    uint txHashesCount;
    /// @dev mapping (idx => tx key)
    mapping (uint => bytes32) index2hashMapping;
    /// @dev mapping (tx key => idx)
    mapping (bytes32 => uint) hash2indexMapping;
    /// @dev mapping (tx key => tx details)
    mapping (bytes32 => Transaction) txBodies;

    /// @dev Only trusted accounts are permited to call this function
    modifier onlyTrusted() {
      if (contractOwner == msg.sender
        || isAuthorized(msg.sender)
        || store.store.manager().hasAccess(msg.sender)
        || MultiEventsHistory(getEventsHistory()).isAuthorized(msg.sender)) {
          _;
        }
    }

    /// @notice Contract creation
    /// @param _store Storage contract address
    /// @param _crate a name of scope in Storage where all data will be held
    function PendingManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
    }

    /* PUBLIC */

    /// @notice PendingManager (re-)initialization
    function init(address _contractsManager) onlyContractOwner public returns (uint errorCode) {
        BaseManager.init(_contractsManager, "PendingManager");
        return OK;
    }

    /// @notice Gets a number of transactions that are waiting for confirmation (revocation)
    function pendingsCount() public view returns (uint) {
        return txHashesCount;
    }

    /// @notice Gets pending transactions description
    ///
    /// @return {
    ///     "_hashes": "list of hashes",
    ///     "_yetNeeded": "list of amount of confirmations needed",
    ///     "_ownersDone": "list of bitmasks with owners who already confirmed",
    ///     "_timestamp": "list of timestamps"
    /// }
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

    /// @notice Gets a single transaction description
    ///
    /// @param _hash key of tx
    ///
    /// @return {
    ///     "_data": "data of transaction",
    ///     "_yetNeeded": "amount of confirmations needed",
    ///     "_ownersDone": bitmask with owners who already confirmed",
    ///     "_timestamp": "timestamp"
    /// }
    function getTx(bytes32 _hash) public view returns (bytes _data, uint _yetNeeded, uint _ownersDone, uint _timestamp) {
        Transaction storage _tx = txBodies[_hash];
        (_data, _yetNeeded, _ownersDone, _timestamp) = (_tx.data, _tx.yetNeeded, _tx.ownersDone, _tx.timestamp);
    }

    /// @notice Gets an amount of needed confirmations for provided transaction hash
    /// @param _hash key of tx
    function pendingYetNeeded(bytes32 _hash) public view returns (uint) {
        return txBodies[_hash].yetNeeded;
    }

    /// @notice Gets a data that was passed with transaction with provided hash
    /// @param _hash key of tx
    function getTxData(bytes32 _hash) public view returns (bytes) {
        return txBodies[_hash].data;
    }

    /// @notice Gets an information whether provided owner had confirmed pending transaction or not
    /// Only authorized address could be passed as an owner.
    ///
    /// @param _hash key of tx
    /// @param _owner user address an info of which has been asked for
    ///
    /// @return `true` if confirmed, `false` otherwise of such transaction is not in pending queue
    function hasConfirmed(bytes32 _hash, address _owner) public view returns (bool) {
        // determine the bit to set for this owner
        address userManager = getUserManager();
        uint ownerIndexBit = 2 ** UserManagerInterface(userManager).getMemberId(_owner);
        return (txBodies[_hash].ownersDone & ownerIndexBit) != 0;
    }

    /// @notice Gets an address of UserManager currenty used by this contract
    function getUserManager() public view returns (address) {
        return lookupManager("UserManager");
    }

    /// @notice Add a transaction that should be confirmed by authorized users and only then be performed.
    ///
    /// @param _hash key for tx (value of resulted hash will be posted in an event)
    /// @param _data data of ts
    /// @param _to target of tx
    /// @param _sender who is an initiator of a call
    ///
    /// @return errorCode result code of an operation. When yetNeeded <= 1 returns OK, otherwise MULTISIG_ADDED (in case of success)
    function addTx(bytes32 _hash, bytes _data, address _to, address _sender)
    onlyTrusted()
    onlyAuthorizedContract(_sender)
    public
    returns (uint errorCode)
    {
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

    /// @notice Confirms a transaction proposal and if it is the last vote then invokes stored function
    /// Allowed only for authorized addresses
    /// @param _hash key of tx
    /// @return result code of an operation
    function confirm(bytes32 _hash) external onlyAuthorized returns (uint) {
        uint errorCode = conf(_hash, msg.sender);
        return _checkAndEmitError(errorCode);
    }

    /// @notice Revokes a prior confirmation of the given operation
    /// Allowed only for authorized addresses
    /// @param _hash key of tx
    /// @return errorCode result code of an operation
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

    /// @notice Do not accept any Ether
    function () public payable {
        revert();
    }

    /* INTERNAL */

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
}
