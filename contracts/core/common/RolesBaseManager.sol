/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "./RolesManaged.sol";


/// @title TODO
contract RolesBaseManager is RolesManaged {

    address eventsEmitter;

    uint constant REINITIALIZED = 6;

    function RolesBaseManager(Storage _store, bytes32 _crate) RolesManaged(_store, _crate) public {
        eventsEmitter = this;
    }

    function getEventsHistory() public view returns (address) {
        return eventsEmitter;
    }

    function setEventsHistory(address _eventsHistory) onlyContractOwner external {
        eventsEmitter = _eventsHistory;
    }

    function destroy() onlyContractOwner public {
        ContractsManagerInterface(contractsManager).removeContract(this);

        Owned.destroy();
    }

    ///  @dev Designed to be used by ancestors, inits internal fields.
    ///  Will rollback transaction if something goes wrong during initialization.
    ///  Registers contract as a service in ContractManager with given `_type`.
    ///
    ///  @param _contractsManager is contract manager, must be not 0x0
    ///  @param _type is an identificator, could be 0x0
    ///  @return OK if newly initialized and everything is OK,
    ///  or REINITIALIZED if storage already contains some data. Will crash in any other cases.
    function init(address _contractsManager, bytes32 _type) internal returns (uint) {
        // since this method is designed to be used by ancestors
        // do not even allow non-owner to call this
        require(contractOwner == msg.sender);
        require(_contractsManager != 0x0);

        bool reinitialized = (contractsManager != 0x0);

        if (contractsManager == 0x0 || contractsManager != _contractsManager) {
            contractsManager = _contractsManager;
        }

        ContractsManagerInterface serviceProvider = ContractsManagerInterface(contractsManager);

        address multiEventsHistory = serviceProvider.getContractAddressByType("MultiEventsHistory");
        if (multiEventsHistory != 0x0 && multiEventsHistory != eventsEmitter) {
            eventsEmitter = multiEventsHistory;
        }

        if (_type != 0x0) {
            assert(OK == serviceProvider.addContract(this, _type));
        }

        return !reinitialized ? OK : REINITIALIZED;
    }
}
