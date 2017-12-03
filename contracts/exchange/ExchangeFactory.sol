pragma solidity ^0.4.15;

import "./ExchangeRouter.sol";
import "../core/common/OwnedInterface.sol";

/// @title Exchange Factory contract
///
/// @notice Just util contract used for Exchange creation
contract ExchangeFactory {
    /// @notice Creates Exchange contract and transfers ownership to sender
    /// @return exchange's address
    function createExchange(address _contractsManager, address _backend) public returns (address) {
        OwnedInterface exchange = OwnedInterface(new ExchangeRouter(_contractsManager, _backend));
        if (!exchange.transferContractOwnership(msg.sender)) {
            revert();
        }

        return exchange;
    }
}
