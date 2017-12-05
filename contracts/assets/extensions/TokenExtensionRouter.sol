pragma solidity ^0.4.11;

import "./BaseRouter.sol";
import "../../core/contracts/ContractsManagerInterface.sol";
import "./PlatformTokenExtensionGatewayManagerEmitter.sol";

contract TokenExtensionRouter is BaseRouter, PlatformTokenExtensionGatewayManagerEmitter {
    address internal contractsManager;
    address public platform;

    function TokenExtensionRouter(address _contractsManager, address _platform) public {
        contractsManager = _contractsManager;
        platform = _platform;
    }

    function backend() internal constant returns (address _backend) {
        _backend = ContractsManagerInterface(contractsManager).getContractAddressByType("TokenExtensionGateway");
        require(_backend != 0x0);
    }
}
