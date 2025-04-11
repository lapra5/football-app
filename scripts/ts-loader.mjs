import { register } from 'ts-node/esm/dist/index.js';
import { pathToFileURL } from 'url';

register({
  project: './tsconfig.json',
  loader: 'ts-node/esm',
});
