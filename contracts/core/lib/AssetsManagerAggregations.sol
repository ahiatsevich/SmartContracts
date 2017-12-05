pragma solidity ^0.4.11;

import "../storage/Storage.sol";
import "../storage/StorageInterface.sol";
import "../platform/ChronoBankPlatformInterface.sol";
import "../platform/ChronoBankAssetOwnershipManager.sol";
import "../platform/ChronoBankAssetProxyInterface.sol";
import "../../assets/PlatformsManagerInterface.sol";
import "../../assets/TokenManagementInterface.sol";

library AssetsManagerAggregations {

    using StorageInterface for *;

    function getTokenExtension(
        StorageInterface.Config storage store,
        StorageInterface.AddressAddressMapping storage _platformToExtension,
        address _platform
    )
    internal constant returns (address)
    {
        return store.get(_platformToExtension, _platform);
    }

    /**
    * @dev TODO
    */
    function isAssetOwner(
        StorageInterface.Config storage store,
        StorageInterface.AddressAddressMapping storage _platformToExtension,
        bytes32 _symbol,
        address _token,
        address _user
    )
    public constant returns (bool)
    {
        address _platform = ChronoBankAssetProxyInterface(_token).chronoBankPlatform();
        address _tokenExtension = getTokenExtension(store, _platformToExtension, _platform);
        address _assetOwnershipManager = TokenManagementInterface(_tokenExtension).getAssetOwnershipManager();
        return ChronoBankAssetOwnershipManager(_assetOwnershipManager).hasAssetRights(_user, _symbol);
    }

    /**
    * @dev TODO
    */
    function getAssetForOwnerAtIndex(
        address _tokenExtensionAddr,
        address _owner,
        uint _idx
    )
    public constant returns (bytes32)
    {
        TokenManagementInterface _tokenExtension = TokenManagementInterface(_tokenExtensionAddr);
        ChronoBankAssetOwnershipManager _assetsOwnershipManager = ChronoBankAssetOwnershipManager(_tokenExtension.getAssetOwnershipManager());

        uint currentIdx = _idx - 1;
        uint symbolsCount = _assetsOwnershipManager.symbolsCount();
        uint symbolsIdx;
        bytes32 _symbol;
        for (symbolsIdx = _idx; symbolsIdx < symbolsCount; ++symbolsIdx) {
            _symbol = _assetsOwnershipManager.symbols(symbolsIdx);
            if (_assetsOwnershipManager.hasAssetRights(_owner, _symbol) && ++currentIdx == _idx) {
                return _symbol;
            }
        }
    }

    /**
    * @dev TODO
    */
    function getAssetsForOwnerCount(
        address _tokenExtensionAddr,
        address _owner
    )
    public constant returns (uint count)
    {
        TokenManagementInterface _tokenExtension = TokenManagementInterface(_tokenExtensionAddr);
        ChronoBankAssetOwnershipManager _assetsOwnershipManager = ChronoBankAssetOwnershipManager(_tokenExtension.getAssetOwnershipManager());

        uint symbolsCount = _assetsOwnershipManager.symbolsCount();
        uint symbolsIdx;
        bytes32 _symbol;
        for (symbolsIdx = 0; symbolsIdx < symbolsCount; ++symbolsIdx) {
            _symbol = _assetsOwnershipManager.symbols(symbolsIdx);
            if (_assetsOwnershipManager.hasAssetRights(_owner, _symbol)) {
                count++;
            }
        }
    }

    /**
    * @dev TODO
    */
    function getSystemAssetsForOwnerCount(
        StorageInterface.Config storage store,
        StorageInterface.AddressesSetMapping storage _userToPlatformsCollection,
        StorageInterface.Bytes32SetMapping storage _userWithPlatformToOwnedSymbols,
        address _owner
    )
    public constant returns (uint count)
    {
        bytes32 _ownerKey = bytes32(_owner);
        uint _platformsCount = store.count(_userToPlatformsCollection, _ownerKey);
        for (uint _platformIdx = 0; _platformIdx < _platformsCount; ++_platformIdx) {
            count += store.count(_userWithPlatformToOwnedSymbols, keccak256(_owner, store.get(_userToPlatformsCollection, _ownerKey, _platformIdx)));
        }
    }

    /**
    * @dev TODO
    */
    function getManagers(
        StorageInterface.Config storage store,
        StorageInterface.AddressesSetMapping storage _symbolWithPlatformToUsers,
        address _platformsManager,
        address _owner
    )
    internal constant returns (address[] _managers)
    {
        PlatformsManagerInterface _platformsManagerInterface = PlatformsManagerInterface(_platformsManager);
        uint _platformsCount = _platformsManagerInterface.getPlatformsForUserCount(_owner);
        _managers = new address[](_numberOfManagers(_owner, _platformsManager));
        uint _managersPointer = 0;
        address[] memory _platformManagers;
        for (uint _platformIdx = 0; _platformIdx < _platformsCount; ++_platformIdx) {
            address _platform = _platformsManagerInterface.getPlatformForUserAtIndex(_owner, _platformIdx);
            _platformManagers = getManagersForPlatform(store, _symbolWithPlatformToUsers, _platform);
            _managersPointer = _copyArrayIntoArray(_platformManagers, _managers, _managersPointer);
        }
    }

    /**
    * @dev TODO
    */
    function getManagersForPlatform(
        StorageInterface.Config storage store,
        StorageInterface.AddressesSetMapping storage _symbolWithPlatformToUsers,
        address _platform
    )
    private constant returns (address[] _managers)
    {
        ChronoBankPlatformInterface _managersRegistry = ChronoBankPlatformInterface(_platform);

        uint _symbolsCount = _managersRegistry.symbolsCount();
        _managers = new address[](ChronoBankManagersRegistry(_platform).holdersCount() * _symbolsCount);
        uint _managersPointer;
        address[] memory _symbolManagers;
        bytes32 _symbol;
        for (uint _symbolIdx = 0; _symbolIdx < _symbolsCount; ++_symbolIdx) {
            _symbol = _managersRegistry.symbols(_symbolIdx);
            _symbolManagers = store.get(_symbolWithPlatformToUsers, keccak256(_symbol, _platform));
            _managersPointer = _copyArrayIntoArray(_symbolManagers, _managers, _managersPointer);
        }
    }

    /**
    * @dev TODO
    */
    function _copyArrayIntoArray(address[] _origin, address[] _destination, uint _pointer) private returns (uint) {
        for (uint _originIdx = 0; _originIdx < _origin.length && _origin[_originIdx] != 0x0; ++_originIdx) {
            _destination[_pointer++] = _origin[_originIdx];
        }
        return _pointer;
    }

    /**
    * @dev TODO
    */
    function _numberOfManagers(address _owner, address _platformsManager) private constant returns (uint _count) {
        PlatformsManagerInterface _platformsManagerInterface = PlatformsManagerInterface(_platformsManager);
        uint _platformsCount = _platformsManagerInterface.getPlatformsForUserCount(_owner);

        for (uint _platformIdx = 0; _platformIdx < _platformsCount; ++_platformIdx) {
            address _platform = _platformsManagerInterface.getPlatformForUserAtIndex(_owner, _platformIdx);
            _count += ChronoBankManagersRegistry(_platform).holdersCount() * ChronoBankPlatformInterface(_platform).symbolsCount();
        }
    }
}
