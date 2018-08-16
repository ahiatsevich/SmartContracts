/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


contract ChronoBankAssetBlacklistableEmitter {

    /// @dev restriction/Unrestriction events
    event Restricted(bytes32 indexed symbol, address restricted);
    event Unrestricted(bytes32 indexed symbol, address unrestricted);

    function emitRestricted(bytes32 _symbol, address _restricted) public {
        emit Restricted(_symbol, _restricted);
    }

    function emitUnrestricted(bytes32 _symbol, address _unrestricted) public {
        emit Unrestricted(_symbol, _unrestricted);
    }
}