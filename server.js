// Group call + transcript server. No database: transcripts live in memory
// while the server runs. Download them before the call room empties for long.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PASSCODE = process.env.PASSCODE || '';          // optional team passcode
const MAX = parseInt(process.env.MAX_MEMBERS || '15', 10);
const ICE = process.env.ICE_SERVERS
  ? JSON.parse(process.env.ICE_SERVERS)
  : [{ urls: 'stun:stun.l.google.com:19302' }];

const rooms = new Map(); // name -> { members: Map(id -> {ws,name}), lines: [] }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clock = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const cleanRoom = r => String(r || 'team').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'team';
const uid = () => Math.random().toString(36).slice(2, 10);

function getRoom(n) {
  if (!rooms.has(n)) rooms.set(n, { members: new Map(), lines: [] });
  return rooms.get(n);
}
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/ice') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ iceServers: ICE, passcode: !!PASSCODE }));
  }
  if (url.pathname === '/export') {
    if (PASSCODE && url.searchParams.get('key') !== PASSCODE) { res.writeHead(403); return res.end('Wrong passcode'); }
    const name = cleanRoom(url.searchParams.get('room'));
    const fmt = url.searchParams.get('fmt') === 'doc' ? 'doc' : 'xls';
    const lines = (rooms.get(name) || { lines: [] }).lines;
    let body = '<html><head><meta charset="utf-8"></head><body>';
    if (fmt === 'xls') {
      body += '<table border="1"><tr><th>No</th><th>Date</th><th>Time</th><th>Speaker</th><th>Sentence</th></tr>';
      lines.forEach((l, i) => body += `<tr><td>${i + 1}</td><td>${l.date}</td><td>${l.time}</td><td>${esc(l.name)}</td><td>${esc(l.text)}</td></tr>`);
      body += '</table>';
    } else {
      body += `<h2>Call Transcript - ${esc(name)}</h2>`;
      lines.forEach(l => body += `<p>[${l.date} ${l.time}] <b>${esc(l.name)}:</b> ${esc(l.text)}</p>`);
    }
    body += '</body></html>';
    res.writeHead(200, {
      'Content-Type': fmt === 'xls' ? 'application/vnd.ms-excel; charset=utf-8' : 'application/msword; charset=utf-8',
      'Content-Disposition': `attachment; filename="call_${name}_${today()}.${fmt}"`
    });
    return res.end('\ufeff' + body);
  }
  // static page
   fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); return res.end('Missing public/index.html'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

wss.on('connection', ws => {
  let me = null, roomName = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'join' && !me) {
      if (PASSCODE && m.pass !== PASSCODE) return send(ws, { type: 'error', msg: 'Wrong passcode' });
      roomName = cleanRoom(m.room);
      const room = getRoom(roomName);
      if (room.members.size >= MAX) return send(ws, { type: 'error', msg: `Room is full (${MAX} people)` });
      me = { id: uid(), name: String(m.name || 'Guest').slice(0, 30), ws };
      const peers = [...room.members.values()].map(p => ({ id: p.id, name: p.name }));
      room.members.set(me.id, me);
      send(ws, { type: 'welcome', id: me.id, peers, lines: room.lines.slice(-200) });
      room.members.forEach(p => { if (p.id !== me.id) send(p.ws, { type: 'peer-join', id: me.id, name: me.name }); });
    } else if (me && m.type === 'sig') {
      const t = getRoom(roomName).members.get(m.to);
      if (t) send(t.ws, { type: 'sig', from: me.id, kind: m.kind, payload: m.payload });
    } else if (me && m.type === 'line') {
      const text = String(m.text || '').trim().slice(0, 600);
      if (!text) return;
      const room = getRoom(roomName);
      const line = { name: me.name, text, time: clock(), date: today(), id: me.id };
      room.lines.push(line);
      room.members.forEach(p => send(p.ws, { type: 'line', ...line }));
    }
  });

  ws.on('close', () => {
    if (!me) return;
    const room = rooms.get(roomName); if (!room) return;
    room.members.delete(me.id);
    room.members.forEach(p => send(p.ws, { type: 'peer-left', id: me.id }));
  });
});

setInterval(() => wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }), 25000);
server.listen(PORT, () => console.log('Call transcriber running on port ' + PORT));
