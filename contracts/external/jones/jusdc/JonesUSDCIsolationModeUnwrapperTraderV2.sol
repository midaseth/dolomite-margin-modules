// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { JonesUSDCMathLib } from "./JonesUSDCMathLib.sol";
import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";
import { IsolationModeUnwrapperTraderV2 } from "../../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   JonesUSDCIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping jUSDC into USDC. During settlement, the redeemed jUSDC is sent from the user's vault to
 *          this contract to process the unwrapping.
 */
contract JonesUSDCIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using JonesUSDCMathLib for IJonesUSDCRegistry;

    // ============ Constants ============

    bytes32 private constant _FILE = "JonesUSDCUnwrapperV2";

    // ============ Immutable State Variables ============

    IERC20 public immutable USDC; // solhint-disable-line var-name-mixedcase
    IJonesUSDCRegistry public immutable JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _jonesUSDCRegistry,
        address _djUSDC,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _djUSDC,
        _dolomiteMargin
    ) {
        USDC = IERC20(_usdc);
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesUSDCRegistry);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(USDC);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256,
        address,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        JONES_USDC_REGISTRY.glpVaultRouter().stableWithdrawalSignal(_inputAmount, /* _compound = */ true);
        return USDC.balanceOf(address(this)); // report the amount of USDC in this contract as amountOut
    }

    function _getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        (uint256 retentionFee, uint256 retentionFeeBase) = JONES_USDC_REGISTRY.getRetentionFee();
        uint256 assets = JONES_USDC_REGISTRY.jUSDC().previewRedeem(_desiredInputAmount);
        return assets - (assets * retentionFee / retentionFeeBase);
    }
}
