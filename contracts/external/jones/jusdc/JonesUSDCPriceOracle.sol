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

import { JonesUSDCMathLib } from "./JonesUSDCMathLib.sol";
import { IDolomiteMargin } from "../../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../../../protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { IERC4626 } from "../../interfaces/IERC4626.sol";
import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";


/**
 * @title   JonesUSDCPriceOracle
 * @author  Dolomite
 *
 * @notice  An implementation of the IDolomitePriceOracle interface that gets Jones DAO's jUSDC price in USD terms.
 */
contract JonesUSDCPriceOracle is IDolomitePriceOracle {
    using JonesUSDCMathLib for IJonesUSDCRegistry;

    // ============================ Constants ============================

    bytes32 private constant _FILE = "JonesUSDCPriceOracle";

    // ============================ Public State Variables ============================

    IDolomiteMargin immutable public DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase
    IJonesUSDCRegistry immutable public JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase
    uint256 immutable public USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    address immutable public DJUSDC; // solhint-disable-line var-name-mixedcase

    // ============================ Constructor ============================

    constructor(
        address _dolomiteMargin,
        address _jonesUSDCRegistry,
        uint256 _usdcMarketId,
        address djUSDC
    ) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesUSDCRegistry);
        USDC_MARKET_ID = _usdcMarketId;
        DJUSDC = djUSDC;
    }

    function getPrice(
        address _token
    )
    public
    view
    returns (IDolomiteStructs.MonetaryPrice memory) {
        Require.that(
            _token == DJUSDC,
            _FILE,
            "Invalid token",
            _token
        );
        Require.that(
            DOLOMITE_MARGIN.getMarketIsClosing(DOLOMITE_MARGIN.getMarketIdByTokenAddress(_token)),
            _FILE,
            "jUSDC cannot be borrowable"
        );

        return IDolomiteStructs.MonetaryPrice({
            value: _getCurrentPrice()
        });
    }

    // ============================ Internal Functions ============================

    function _getCurrentPrice() internal view returns (uint256) {
        uint256 usdcPrice = DOLOMITE_MARGIN.getMarketPrice(USDC_MARKET_ID).value;
        IERC4626 jUSDC = JONES_USDC_REGISTRY.jUSDC();
        uint256 totalSupply = jUSDC.totalSupply();
        if (totalSupply == 0) {
            // exchange rate is 1 if the total supply is 0
            return usdcPrice;
        }
        uint256 price = usdcPrice * jUSDC.totalAssets() / totalSupply;
        (uint256 retentionFee, uint256 retentionFeeBase) = JONES_USDC_REGISTRY.getRetentionFee();
        return price - (price * retentionFee / retentionFeeBase);
    }
}
