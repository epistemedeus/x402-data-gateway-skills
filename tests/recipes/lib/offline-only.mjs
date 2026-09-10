// Fixture recipes must never fall through to real network access.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
let attempted = false;
function blocked() { attempted = true; throw new Error('recipe attempted non-fixture network access'); }
globalThis.fetch = blocked;
net.Socket.prototype.connect = blocked;
http.request = blocked; http.get = blocked;
https.request = blocked; https.get = blocked;
syncBuiltinESMExports();
process.on('beforeExit', () => { if (attempted) { console.error('recipe attempted non-fixture network access'); process.exitCode = 1; } });
