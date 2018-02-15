pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';


/// @title PendingManagerEmitter
contract PendingManagerEmitter is MultiEventsHistoryAdapter {
    event Confirmation(address indexed self, address indexed owner, bytes32 indexed hash);
    event Revoke(address indexed self, address indexed owner, bytes32 indexed hash);
    event Cancelled(address indexed self, bytes32 indexed hash);
    event Done(address indexed self, bytes32 indexed hash, bytes data, uint timestamp);
    event Error(address indexed self, uint errorCode);

    function emitConfirmation(address _owner, bytes32 _hash) public {
        Confirmation(_self(), _owner, _hash);
    }

    function emitRevoke(address _owner, bytes32 _hash) public {
        Revoke(_self(), _owner, _hash);
    }

    function emitCancelled(bytes32 _hash) public {
        Cancelled(_self(), _hash);
    }

    function emitDone(bytes32 _hash, bytes _data, uint _timestamp) public {
        Done(_self(), _hash, _data, _timestamp);
    }

    function emitError(uint _errorCode) public {
        Error(_self(), _errorCode);
    }
}
