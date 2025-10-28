import { build } from 'tsdown';
import { serverTarget } from './tsdown.debug.config';

console.log(`${new Date().toISOString()} - Building server`);
await build(serverTarget);
console.log(`${new Date().toISOString()} - Server built`);
