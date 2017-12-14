pragma solidity ^0.4.11;

import "../core/common/BaseManager.sol";
import "../core/common/Once.sol";
import "../core/erc20/ERC20ManagerInterface.sol";
import "../core/platform/ChronoBankAssetProxyInterface.sol";
import "../core/platform/ChronoBankAssetOwnershipManager.sol";
import "../core/platform/ChronoBankPlatformInterface.sol";
import "../core/platform/ChronoBankPlatform.sol";
import "./TokenManagementInterface.sol";
import "./AssetsManagerInterface.sol";
import "./AssetsManagerEmitter.sol";


contract OwnedContract {
    address public contractOwner;
}


contract TokenExtensionsFactory {
    function createTokenExtension(address _platform) public returns (address);
}


contract EventsHistory {
    function authorize(address _eventEmitter) public returns (bool);
    function reject(address _eventEmitter) public;
}


/// @title AssetsManager is a helper contract which allows centralized access to tokens' management
/// on top of chronobank platforms. It is used in pair with PlatformsManager and provides
/// a creation of token extensions for platforms.
/// Contract also has methods for quick access to token info such as:
/// - token address by symbol,
/// - if token exists in a system,
/// - if a user is a owner of a token.
contract AssetsManager is AssetsManagerInterface, TokenExtensionRegistry, BaseManager, AssetsManagerEmitter {

    /** Error codes */

    uint constant ERROR_ASSETS_MANAGER_SCOPE = 30000;
    uint constant ERROR_ASSETS_MANAGER_INVALID_INVOCATION = ERROR_ASSETS_MANAGER_SCOPE + 2;
    uint constant ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS = ERROR_ASSETS_MANAGER_SCOPE + 3;

    /** Storage keys */

    /// @dev address of a token extension factory contract
    StorageInterface.Address tokenExtensionFactory;

    /// @dev address of a token and proxy factory contract
    StorageInterface.Address tokenFactory;

    /// @dev mapping (address => address) stands for (platform => tokenExtension)
    StorageInterface.AddressAddressMapping platformToExtension;

    /// @dev collection of addresses of token extensions registered in AssetsManager
    StorageInterface.OrderedAddressesSet tokenExtensions;

    /// @dev Guards methods for callers that are owners of a platform
    modifier onlyPlatformOwner(address _platform) {
        if (OwnedContract(_platform).contractOwner() == msg.sender) {
            _;
        }
    }

    /// @notice Constructor function
    /// @param _store link to a global storage
    /// @param _crate namespace in a storage
    function AssetsManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        tokenExtensionFactory.init("tokenExtensionFactory");
        tokenFactory.init("tokenFactory");
        platformToExtension.init("v1platformToExtension");
        tokenExtensions.init("v1tokenExtensions");
    }

    /// @notice Initalizer. Used by contract owner to initialize and re-initialize contract after deploying new versions
    /// of related dependencies.
    ///
    /// @param _contractsManager contracts manager
    /// @param _tokenExtensionFactory token extension factory address
    /// @param _tokenFactory token and proxy factory address
    ///
    /// @return result code of an operation. `OK` if all went well
    function init(
        address _contractsManager,
        address _tokenExtensionFactory,
        address _tokenFactory
    )
    onlyContractOwner
    public
    returns (uint)
    {
        BaseManager.init(_contractsManager, "AssetsManager");
        setTokenExtensionFactory(_tokenExtensionFactory);
        setTokenFactory(_tokenFactory);

        return OK;
    }

    /// @notice Gets an address of currenty used token extension factory
    /// @return address of a factory
    function getTokenExtensionFactory() public view returns (address) {
        return store.get(tokenExtensionFactory);
    }

    /// @notice Sets a new address of token extension factory contract as currently used in AssetsManager
    /// @param _tokenExtensionFactory address of an updated token extension factory contract
    /// @return result code of an operation. `OK` if all went well
    function setTokenExtensionFactory(address _tokenExtensionFactory) onlyContractOwner public returns (uint) {
        require(_tokenExtensionFactory != 0x0);

        store.set(tokenExtensionFactory, _tokenExtensionFactory);
        return OK;
    }

    /// @notice Gets an address of currenty used token and proxy factory
    /// @return address of a factory
    function getTokenFactory() public view returns (address) {
        return store.get(tokenFactory);
    }

    /// @notice Sets a new address of token and proxy factory contract as currently used in AssetsManager
    /// @param _tokenFactory address of an updated token and proxy factory contract
    /// @return result code of an operation. `OK` if all went well
    function setTokenFactory(address _tokenFactory) onlyContractOwner public returns (uint) {
        require(_tokenFactory != 0x0);

        store.set(tokenFactory, _tokenFactory);
        return OK;
    }

    /// @dev Checks if a provided token extension address is a part of the system
    /// @param _tokenExtension address of a token extension
    /// @return `true` if a token extension is inside AssetsManager, `false` otherwise
    function containsTokenExtension(address _tokenExtension) public view returns (bool) {
        return store.includes(tokenExtensions, _tokenExtension);
    }

    /// @notice Registers and stores token extension of a platform into the system. Mostly this method should be used
    /// when platform's token extention was removed manually from AssetsManager or there was no token extension at all.
    /// It is preferred to create token extension by calling requestTokenExtension: this will ensure that the latest
    /// version of token extension contract will be used.
    /// There might be ONLY ONE token extension at a time associated with a platform and be registered in the system.
    /// Can be used only by platform's owner associated with this token extension.
    ///
    /// @param _tokenExtension address of token extension
    ///
    /// @return result code of an operation. ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS might be returned.
    function registerTokenExtension(address _tokenExtension)
    onlyPlatformOwner(TokenManagementInterface(_tokenExtension).platform())
    public
    returns (uint)
    {
        if (store.includes(tokenExtensions, _tokenExtension)) {
            return _emitError(ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS);
        }

        address _platform = TokenManagementInterface(_tokenExtension).platform();
        if (store.get(platformToExtension, _platform) != 0x0) {
            return _emitError(ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS);
        }

        _setupTokenExtension(_platform, _tokenExtension);
        _emitTokenExtensionRegistered(_platform, _tokenExtension);
        return OK;
    }

    /// @notice Unregisters and removes token extension from the system. It should be used when you know what are you doing,
    /// because it will remove record of token extension for a platform and to continue using an associated token extension
    /// with platform you should register a new token extension address or request a brand new one (see `requestTokenExtension` method).
    /// Can be used only by platform's owner associated with this token extension.
    ///
    /// @param _tokenExtension address of a token extension
    ///
    /// @return result code of an operation. ERROR_ASSETS_MANAGER_INVALID_INVOCATION might be returned.
    function unregisterTokenExtension(address _tokenExtension)
    onlyPlatformOwner(TokenManagementInterface(_tokenExtension).platform())
    public
    returns (uint)
    {
        if (!store.includes(tokenExtensions, _tokenExtension)) {
            return _emitError(ERROR_ASSETS_MANAGER_INVALID_INVOCATION);
        }

        store.remove(tokenExtensions, _tokenExtension);
        store.set(platformToExtension, TokenManagementInterface(_tokenExtension).platform(), 0x0);
        EventsHistory(getEventsHistory()).reject(_tokenExtension);

        _emitTokenExtensionUnregistered(_tokenExtension);
        return OK;
    }

    /// @notice Provides a way to "request" (meant check if a token extension exists for a passed platform and if it doesn't then
    /// create a new one).
    /// @param _platform address of a platform for which token extension is requested
    /// @return result code of an operation.
    function requestTokenExtension(address _platform) public returns (uint) {
        address _tokenExtension = getTokenExtension(_platform);
        if (_tokenExtension != 0x0) {
            _emitTokenExtensionRequested(_platform, _tokenExtension);
            return OK;
        }

        TokenExtensionsFactory _extensionsFactory = TokenExtensionsFactory(store.get(tokenExtensionFactory));
        _tokenExtension = _extensionsFactory.createTokenExtension(_platform);
        _setupTokenExtension(_platform, _tokenExtension);

        _emitTokenExtensionRequested(_platform, _tokenExtension);
        return OK;
    }

    /// @notice Gets an associated token extension address with provided platform. If no token extension was found
    /// then return 0x0.
    /// @param _platform platform address for associated token extension
    /// @return address of found token extension
    function getTokenExtension(address _platform) public view returns (address) {
        return store.get(platformToExtension, _platform);
    }

    /// @notice Checks if a user has access rights and an owner of a token with provided symbol
    /// @param _symbol symbol associated with some token
    /// @param _user a user which should be tested for ownership
    /// @return `true` if a user is an owner, `false` otherwise
    function isAssetOwner(bytes32 _symbol, address _user) public view returns (bool) {
        address _token = getAssetBySymbol(_symbol);
        address _platform = ChronoBankAssetProxyInterface(_token).chronoBankPlatform();
        address _tokenExtension = getTokenExtension(_platform);
        address _assetOwnershipManager = TokenManagementInterface(_tokenExtension).getAssetOwnershipManager();
        return ChronoBankAssetOwnershipManager(_assetOwnershipManager).hasAssetRights(_user, _symbol);
    }

    /// @notice Checks if a token with such symbol is registered in the system
    /// @param _symbol symbol associated with some token
    /// @return `true` if token with passed symbol exists, `false` otherwise
    function isAssetSymbolExists(bytes32 _symbol) public view returns (bool) {
        return getAssetBySymbol(_symbol) != 0x0;
    }

    /// @notice Gets token's address which is associated with a symbol
    /// @param _symbol symbol associated with some token
    /// @return address of a token with passed symbol
    function getAssetBySymbol(bytes32 _symbol) public view returns (address) {
        return ERC20ManagerInterface(lookupManager("ERC20Manager")).getTokenAddressBySymbol(_symbol);
    }

    /// @notice Gets a number of assets in a platform where passed user is an owner.
    /// @param _platform hosting platform
    /// @param _owner user to be checked for ownership
    /// @return a number of assets in user's ownership
    function getAssetsForOwnerCount(address _platform, address _owner) public view returns (uint count) {
        TokenManagementInterface _tokenExtension = TokenManagementInterface(getTokenExtension(_platform));
        ChronoBankAssetOwnershipManager _assetsOwnershipManager = ChronoBankAssetOwnershipManager(_tokenExtension.getAssetOwnershipManager());

        uint symbolsCount = _assetsOwnershipManager.symbolsCount();
        for (uint symbolsIdx = 0; symbolsIdx < symbolsCount; ++symbolsIdx) {
            bytes32 _symbol = _assetsOwnershipManager.symbols(symbolsIdx);
            if (_assetsOwnershipManager.hasAssetRights(_owner, _symbol)) {
                ++count;
            }
        }
    }

    /// @notice Returns the exact asset symbol hosted in a platform with passed user as an owner by accessing it by index.
    ///
    /// @param _platform hosting platform
    /// @param _owner user to be checked for ownership
    /// @param _idx index of a symbol. Should no more than number of assets for this owner minus 1
    ///
    /// @return symbol of an asset
    function getAssetForOwnerAtIndex(
        address _platform,
        address _owner,
        uint _idx
    )
    public
    view
    returns (bytes32)
    {
        TokenManagementInterface _tokenExtension = TokenManagementInterface(getTokenExtension(_platform));
        ChronoBankAssetOwnershipManager _assetsOwnershipManager = ChronoBankAssetOwnershipManager(_tokenExtension.getAssetOwnershipManager());

        uint currentIdx = _idx - 1;
        uint symbolsCount = _assetsOwnershipManager.symbolsCount();
        for (uint symbolsIdx = _idx; symbolsIdx < symbolsCount; ++symbolsIdx) {
            bytes32 _symbol = _assetsOwnershipManager.symbols(symbolsIdx);
            if (_assetsOwnershipManager.hasAssetRights(_owner, _symbol) && ++currentIdx == _idx) {
                return _symbol;
            }
        }
    }

    /** Helper functions */

    /// @dev Binds some internal variables during token extension setup. PRIVATE
    function _setupTokenExtension(address _platform, address _tokenExtension) private {
        assert(EventsHistory(getEventsHistory()).authorize(_tokenExtension));

        store.add(tokenExtensions, _tokenExtension);
        store.set(platformToExtension, _platform, _tokenExtension);
    }

    /** Events emitting */

    function _emitError(uint _errorCode) private returns (uint) {
        AssetsManagerEmitter(getEventsHistory()).emitError(_errorCode);
        return _errorCode;
    }

    function _emitTokenExtensionRequested(address _platform, address _tokenExtension) private {
        AssetsManagerEmitter(getEventsHistory()).emitTokenExtensionRequested(_platform, _tokenExtension);
    }

    function _emitTokenExtensionRegistered(address _platform, address _tokenExtension) private {
        AssetsManagerEmitter(getEventsHistory()).emitTokenExtensionRegistered(_platform, _tokenExtension);
    }

    function _emitTokenExtensionUnregistered(address _tokenExtension) private {
        AssetsManagerEmitter(getEventsHistory()).emitTokenExtensionUnregistered(_tokenExtension);
    }
}
