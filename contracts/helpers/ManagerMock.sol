pragma solidity ^0.4.11;

contract ManagerMock {
    bool denied;

    function deny() public {
        denied = true;
    }

    function isAllowed(address _actor, bytes32 _role) public returns (bool) {
        _actor == 0x0;
        _role.length == 0;

        if (denied) {
            denied = false;
            return false;
        }
        return true;
    }

    function hasAccess(address _actor) public pure returns(bool) {
        _actor == 0x0;
        return true;
    }
}
