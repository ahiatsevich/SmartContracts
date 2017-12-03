pragma solidity ^0.4.11;

import "../core/common/BaseByzantiumRouter.sol";
import "./ExchangeEmitter.sol";

/// @title ExchangeRouter.
contract ExchangeRouter is BaseByzantiumRouter, ExchangeEmitter {

    /**
    * Storage variables. DO NOT CHANGE VARIABLES' LAYOUT UNDER ANY CIRCUMSTANCES!
    */

    address internal contractOwner;
    address internal pendingContractOwner;

    address internal backendAddress;
    address internal contractsManager;


    /** PUBLIC section */

    function ExchangeRouter(address _contractsManager, address _backend) public {
        require(_contractsManager != 0x0);
        require(_backend != 0x0);

        contractOwner = msg.sender;
        contractsManager = _contractsManager;
        backendAddress = _backend;
    }

    function setBackend(address _backend) public {
        require(msg.sender == contractOwner);
        backendAddress = _backend;
    }

    /// @notice Gets address of a backend contract
    /// @return _backend address of a backend contract
    function backend() internal constant returns (address) {
        return backendAddress;
    }
}
