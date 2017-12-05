pragma solidity ^0.4.11;

import "./../core/common/Owned.sol";
import "./../core/contracts/ContractsManagerInterface.sol";
import "./extensions/PlatformTokenExtensionGatewayManagerEmitter.sol";
import "./../core/platform/ChronoBankPlatform.sol";
import "./PlatformsManagerInterface.sol";

contract AssetOwnershipDelegateResolver is Owned, AssetOwningListener {
    uint constant OK = 1;

    address internal contractsManager;

    modifier onlyRegisteredPlatformOrManager(address _platform) {
        address _platformManager = lookupManager("PlatformsManager");
        if ((_platform == msg.sender && PlatformsManagerInterface(_platformManager).isPlatformAttached(_platform)) ||
            msg.sender == _platformManager)
        {
            _;
        }
    }

    function AssetOwnershipDelegateResolver() public {
    }

    function init(address _contractsManager) onlyContractOwner public returns (uint) {
        require(_contractsManager != 0x0);
        contractsManager = _contractsManager;
        return ContractsManagerInterface(_contractsManager).addContract(this, "AssetOwnershipResolver");
    }

    function lookupManager(bytes32 _identifier) private constant returns (address _manager) {
        _manager = ContractsManagerInterface(contractsManager).getContractAddressByType(_identifier);
        require(_manager != 0x0);
    }

    function assetOwnerAdded(bytes32 _symbol, address _platform, address _owner) onlyRegisteredPlatformOrManager(_platform) public {
        AssetOwningListener(lookupManager("AssetsManager")).assetOwnerAdded(_symbol, _platform, _owner);
    }

    function assetOwnerRemoved(bytes32 _symbol, address _platform, address _owner) onlyRegisteredPlatformOrManager(_platform) public {
        AssetOwningListener(lookupManager("AssetsManager")).assetOwnerRemoved(_symbol, _platform, _owner);
    }
}
