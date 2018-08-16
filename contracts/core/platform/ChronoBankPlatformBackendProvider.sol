/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.24;


import "../common/Owned.sol";
import "./ChronoBankPlatformInterface.sol";


contract ChronoBankPlatformBackendProvider is Owned {

    ChronoBankPlatformInterface public platformBackend;

    constructor(ChronoBankPlatformInterface _platformBackend) public {
        updatePlatformBackend(_platformBackend);
    }

    function updatePlatformBackend(ChronoBankPlatformInterface _updatedPlatformBackend) 
    public
    onlyContractOwner
    returns (bool)
    {
        require(address(_updatedPlatformBackend) != 0x0, "PLATFORM_BACKEND_PROVIDER_INVALID_PLATFORM_ADDRESS");

        platformBackend = _updatedPlatformBackend;
        return true;
    }
}