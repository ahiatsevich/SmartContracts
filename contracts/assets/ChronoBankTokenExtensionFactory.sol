pragma solidity ^0.4.11;

import "./extensions/TokenExtensionRouter.sol";

/**
* @dev TODO
*/
contract ChronoBankTokenExtensionFactory {

    /** TODO */
    address contractsManager;

    function ChronoBankTokenExtensionFactory(address _contractsManager) {
        contractsManager = _contractsManager;
    }

    /**
    * @dev TODO
    */
    function createTokenExtension(address _platform) public returns (address) {
        address tokenExtension = new TokenExtensionRouter(contractsManager, _platform);
        return tokenExtension;
    }
}
