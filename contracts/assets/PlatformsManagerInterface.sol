pragma solidity ^0.4.11;

contract PlatformsManagerInterface {
    function getPlatformsCount() public view returns (uint);
    function getPlatforms(uint _start, uint _size) public view returns (address[] _platforms);

    function isPlatformAttached(address _platform) public view returns (bool);
}
