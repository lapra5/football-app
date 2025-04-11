// scripts/ts-loader.mjs
import { register } from 'ts-node/esm';
import { pathToFileURL } from 'url';
// scripts/ts-loader.mjs
import 'ts-node/register/esm';


register({
  loader: 'ts-node/esm',
  experimentalSpecifierResolution: 'node',
});
