import { CoreProtocol } from '../../../test/utils/setup';

export function getMagicGLPPriceOracleConstructorParams(core: CoreProtocol): any[] {
  return [
    core.dolomiteMargin.address,
    core.abraEcosystem!.magicGlp.address,
    core.marketIds.dfsGlp!,
  ];
}

export function getMagicGLPUnwrapperTraderV1ConstructorParams(core: CoreProtocol): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxRegistry!.address,
    core.marketIds.usdc,
    core.dolomiteMargin.address,
  ];
}

export function getMagicGLPWrapperTraderV1ConstructorParams(core: CoreProtocol): any[] {
  if (!core.abraEcosystem) {
    throw new Error('Abra ecosystem not initialized');
  }

  return [
    core.abraEcosystem!.magicGlp.address,
    core.gmxRegistry!.address,
    core.dolomiteMargin.address,
  ];
}
