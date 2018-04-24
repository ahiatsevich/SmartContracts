/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "./Managed.sol";
import "../user/Roles2Library.sol";


interface RolesManagedEmitter {
	function emitRoleAuthorizationFailed(address _code, address _sender, bytes4 _sig) external;
}


/// @title TODO
contract RolesManaged is Managed {

	event RoleAuthorizationFailed(address code, address sender, bytes4 sig);

    modifier onlyAuthorizedRole {
        if (!(_isAuthorizedRole(msg.sender, msg.sig) || msg.sender == lookupManager("PendingManager"))) {
            RolesManagedEmitter(_getEventsHistory()).emitRoleAuthorizationFailed(this, msg.sender, msg.sig);
            return;
        }
        _;
    }

	function RolesManaged(Storage _store, bytes32 _crate) Managed(_store, _crate) public {
		
	}

	function emitRoleAuthorizationFailed(address _code, address _sender, bytes4 _sig) external {
		emit RoleAuthorizationFailed(_code, _sender, _sig);
	}

    function _isAuthorizedRole(address _src, bytes4 _sig) internal view returns (bool) {
        if (_src == address(this)) {
            return true;
        }

		address _roles2Library = lookupManager("Roles2Library");
        if (_roles2Library == 0) {
            return false;
        }
        
        return Roles2Library(_roles2Library).canCall(_src, this, _sig);
    }

	function _getEventsHistory() private view returns (address) {
        return lookupManager("MultiEventsHistory");
    }
}