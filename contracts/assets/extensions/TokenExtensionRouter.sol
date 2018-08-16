/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.11;

import "./BaseRouter.sol";
import "../../core/contracts/ContractsManagerInterface.sol";
import "./PlatformTokenExtensionGatewayManagerEmitter.sol";

/**
* @title Lightweight token extension contract that holds platform and contracts manager addresses
* but contains no implementation: all function calls are redirected to TokenExtensionGateway by
* delegatecall. This contract also emits events of token extensions.
*/
contract TokenExtensionRouter is BaseRouter, PlatformTokenExtensionGatewayManagerEmitter {

    /** @dev address of ContractsManager interface contract */
    address internal contractsManager;

    /** @dev platform address to which token extension is attached */
    address public platform;

    constructor(address _contractsManager, address _platform) public {
        contractsManager = _contractsManager;
        platform = _platform;
    }

    function backend() internal constant returns (address _backend) {
        _backend = ContractsManagerInterface(contractsManager).getContractAddressByType("TokenExtensionGateway");
        require(_backend != 0x0, "TOKEN_EXTENSION_FAILED_TO_FETCH_BACKEND");
    }
}
