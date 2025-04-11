// scripts/ts-loader.mjs
import { registerAndCreateEsmLoader } from 'ts-node/esm';
import { pathToFileURL } from 'url';

// Register ts-node
const loader = registerAndCreateEsmLoader();
export const resolve = loader.resolve;
export const getFormat = loader.getFormat;
export const transformSource = loader.transformSource;
