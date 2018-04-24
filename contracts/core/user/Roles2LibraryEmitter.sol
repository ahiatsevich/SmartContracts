/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../event/MultiEventsHistoryAdapter.sol";


/// @title Roles Library emitter.
///
/// Contains all the original event emitting function definitions and events.
/// In case of new events needed later, additional emitters can be developed.
/// All the functions is meant to be called using delegatecall.
contract Roles2LibraryEmitter is MultiEventsHistoryAdapter {

	event RoleAdded(address indexed self, address indexed user, uint8 indexed role);
    event RoleRemoved(address indexed self, address indexed user, uint8 indexed role);
    event CapabilityAdded(address indexed self, address indexed code, bytes4 sig, uint8 indexed role);
    event CapabilityRemoved(address indexed self, address indexed code, bytes4 sig, uint8 indexed role);
    event PublicCapabilityAdded(address indexed self, address indexed code, bytes4 sig);
    event PublicCapabilityRemoved(address indexed self, address indexed code, bytes4 sig);

    /// @dev Something went wrong
    event Error(address indexed self, uint errorCode);

	function emitRoleAdded(address _user, uint8 _role) public {
        emit RoleAdded(_self(), _user, _role);
    }

    function emitRoleRemoved(address _user, uint8 _role) public {
        emit RoleRemoved(_self(), _user, _role);
    }

    function emitCapabilityAdded(address _code, bytes4 _sig, uint8 _role) public {
        emit CapabilityAdded(_self(), _code, _sig, _role);
    }

    function emitCapabilityRemoved(address _code, bytes4 _sig, uint8 _role) public {
        emit CapabilityRemoved(_self(), _code, _sig, _role);
    }

    function emitPublicCapabilityAdded(address _code, bytes4 _sig) public {
        emit PublicCapabilityAdded(_self(), _code, _sig);
    }

    function emitPublicCapabilityRemoved(address _code, bytes4 _sig) public {
        emit PublicCapabilityRemoved(_self(), _code, _sig);
    }

	function emitError(uint _error) public {
        emit Error(_self(), _error);
    }
}
 