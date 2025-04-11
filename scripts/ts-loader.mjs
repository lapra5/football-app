// scripts/ts-loader.mjs
import { register } from 'ts-node/esm';
import { pathToFileURL } from 'url';

register({
  loader: 'ts-node/esm',
  experimentalSpecifierResolution: 'node',
});
