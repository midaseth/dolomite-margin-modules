// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { TokenWrapperLib } from "../external/lib/TokenWrapperLib.sol";

import { WrappedTokenUserVaultWrapper } from "../external/proxies/WrappedTokenUserVaultWrapper.sol";

import { ICustomTestToken } from "./ICustomTestToken.sol";


contract TestWrappedTokenUserVaultFactoryWrapper is WrappedTokenUserVaultWrapper {

    constructor(
        address _vaultFactory,
        address _dolomiteMargin
    ) WrappedTokenUserVaultWrapper(_vaultFactory, _dolomiteMargin) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getExchangeCost(
        address,
        address,
        uint256 _desiredMakerToken,
        bytes calldata
    )
    external
    pure
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        return _desiredMakerToken;
    }

    // ================ Internal Functions ================

    function _exchange(
        address,
        address,
        address,
        address,
        uint256 _amountTakerToken,
        address,
        bytes calldata
    ) internal override returns (uint256) {
        // 1:1 conversion for the sake of testing
        uint256 outputAmount = _amountTakerToken;
        ICustomTestToken(VAULT_FACTORY.UNDERLYING_TOKEN()).addBalance(address(this), outputAmount);
        return outputAmount;
    }
}
