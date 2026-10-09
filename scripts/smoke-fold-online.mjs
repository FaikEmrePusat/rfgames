import { io } from '../client/node_modules/socket.io-client/build/esm/index.js';

const PNG = 'data:image/png;base64,' + 'A'.repeat(80);
const peek = 'data:image/png;base64,' + 'B'.repeat(80);

function connect() {
  return io('http://127.0.0.1:3001', {
    transports: ['websocket', 'polling'],
    timeout: 5000,
  });
}

function ack(sock, event, payload) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout ${event}`)), 8000);
    sock.emit(event, payload, (res) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

function once(sock, event) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`once timeout ${event}`)), 8000);
    sock.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

function waitConnect(sock) {
  return new Promise((resolve, reject) => {
    if (sock.connected) return resolve();
    const t = setTimeout(() => reject(new Error('connect timeout')), 8000);
    sock.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    sock.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

const a = connect();
const b = connect();
await waitConnect(a);
await waitConnect(b);
console.log('connected');

const created = await ack(a, 'fold:create', { playerName: 'Ali', maxPlayers: 2 });
if (!created.ok) throw new Error('create fail ' + created.error);
const code = created.session.roomCode;
console.log('created', code);

const joined = await ack(b, 'fold:join', { code, name: 'Ayse' });
if (!joined.ok) throw new Error('join fail ' + joined.error);
console.log('joined members', joined.session.members.length);

const stateA = once(a, 'fold:state');
const stateB = once(b, 'fold:state');
a.emit('fold:start');
const [sa, sb] = await Promise.all([stateA, stateB]);
console.log('start phase', sa.phase, 'section', sa.currentSection);
console.log('artist A layers', sa.sectionLayers.filter(Boolean).length);
console.log('waiter B layers', sb.sectionLayers.filter(Boolean).length);
if (sb.sectionLayers.some(Boolean)) throw new Error('privacy leak to waiter at start');

const nextA = once(a, 'fold:state');
const nextB = once(b, 'fold:state');
a.emit('fold:submitSection', { layerDataUrl: PNG, peekSafeDataUrl: peek });
const [sa2, sb2] = await Promise.all([nextA, nextB]);
console.log('after fold section', sa2.currentSection, sb2.currentSection);
if (sa2.sectionLayers.some(Boolean)) throw new Error('privacy leak to waiting previous artist');
if (!sb2.sectionLayers[0]) throw new Error('missing peek for next artist');
console.log('peek ok for next artist');

const kap = await ack(a, 'room:create', {
  playerName: 'Kap',
  mapSize: 'small',
  maxPlayers: 2,
});
console.log('kapmaca create', kap.ok, kap.session?.roomCode || kap.error);
if (!kap.ok) throw new Error('kapmaca broken');

a.disconnect();
b.disconnect();
console.log('SMOKE_OK');
