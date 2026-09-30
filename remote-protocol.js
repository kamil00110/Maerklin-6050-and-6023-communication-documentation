// Protocol between the phone remote (remote.html) and the PC (bt-serial-test.html, later control.html)
// over a byte stream (Bluetooth serial port). Made as small as possible:
//
//   remote -> PC:  1 byte per button press
//                  1 C C O O O O O     C = remote / channel 0-3 (remote 1-4), O = command 0-31
//
//   PC -> remote:  1 header byte + 0-3 data bytes, exactly one reply for every command
//                  1 T T T C C R X     T = message type, C = channel, R = 1: reply to a command
//                  0 d d d d d d d     (R = 0: update pushed by the PC, e.g. STOP from control.html)
//                                      X = one extra bit, depends on the type
//
// Only the first byte of a message has the top bit set. A lost or broken byte can therefore
// never shift the messages after it: the next byte with the top bit starts clean again.
(function (global) {
  'use strict';

  // remote -> PC commands
  const CMD = {
    DIGIT: 0,   // 0-9: digit 0-9 (address like on the Control 80f)
    SLOWER: 10,
    FASTER: 11,
    DIR: 12,    // change direction (the loco stops and turns)
    HALT: 13,   // two direction changes: stops at once, direction stays
    GO: 14,
    STOP: 15,
    FN_ON: 16,  // 16-20: function f0 (func) - f4 on
    FN_OFF: 21, // 21-25: function f0 (func) - f4 off
    ADR: 26,
    LOCK: 27,
    SYNC: 28,   // "send me the state of my channel" (connect, channel change, keep-alive)
  };

  // PC -> remote message types (data bytes after the header)
  const MSG = {
    ADDRESS: 0,   // 1 data byte: display. X = 1: the typed address is used by another unit
    SPEED: 1,     // 1 data byte: speed (bits 0-3, 0-14) + direction (bit 4, 1 = reverse)
    FUNCTIONS: 2, // 1 data byte: f0-f4 (bits 0-4)
    STATE: 3,     // 3 data bytes: display, speed + direction, functions. X = track stopped
    STOPGO: 4,    // no data. X = 1: STOP, 0: GO
    NOTICE: 5,    // no data. X = 0: no loco selected, 1: command not supported (yet)
  };
  const DATA_LENGTH = [1, 1, 1, 3, 0, 0, 0, 0];

  // "display" value: what the remote shows as loco address
  const DISPLAY_NONE = 127;    // nothing selected
  const DISPLAY_PENDING = 100; // 100-109: first digit typed, waiting for the second

  const FUNCTION_NAMES = ['func', 'f1', 'f2', 'f3', 'f4'];

  /* ---------- remote -> PC ---------- */

  function command(channel, code) {
    return 0x80 | ((channel & 3) << 5) | (code & 31);
  }

  function parseCommand(byte) {
    return { channel: (byte >> 5) & 3, code: byte & 31 };
  }

  function describeCommand(code) {
    if (code >= CMD.DIGIT && code <= 9) return `digit ${code}`;
    if (code >= CMD.FN_ON && code < CMD.FN_ON + 5) return `${FUNCTION_NAMES[code - CMD.FN_ON]} on`;
    if (code >= CMD.FN_OFF && code < CMD.FN_OFF + 5) return `${FUNCTION_NAMES[code - CMD.FN_OFF]} off`;
    const names = { 10: 'slower', 11: 'faster', 12: 'direction', 13: 'halt', 14: 'GO', 15: 'STOP', 26: 'adr', 27: 'lock', 28: 'sync' };
    return names[code] || `unknown ${code}`;
  }

  /* ---------- PC -> remote ---------- */

  function header(type, channel, reply, extra) {
    return 0x80 | ((type & 7) << 4) | ((channel & 3) << 2) | (reply ? 2 : 0) | (extra ? 1 : 0);
  }

  const speedByte = (speed, dir) => (speed & 15) | (dir ? 16 : 0);
  const functionByte = f => f.reduce((b, on, i) => b | (on ? 1 << i : 0), 0);

  const encode = {
    address: (channel, reply, display, rejected) => [header(MSG.ADDRESS, channel, reply, rejected), display & 127],
    speed: (channel, reply, speed, dir) => [header(MSG.SPEED, channel, reply, 0), speedByte(speed, dir)],
    functions: (channel, reply, functions) => [header(MSG.FUNCTIONS, channel, reply, 0), functionByte(functions)],
    state: (channel, reply, s) => [header(MSG.STATE, channel, reply, s.stopped),
      s.display & 127, speedByte(s.speed, s.dir), functionByte(s.functions)],
    stopgo: (channel, reply, stopped) => [header(MSG.STOPGO, channel, reply, stopped)],
    notice: (channel, reply, unsupported) => [header(MSG.NOTICE, channel, reply, unsupported)],
  };

  // Reads the PC -> remote byte stream; onMessage gets one decoded message at a time
  function createDecoder(onMessage) {
    let head = null;
    let data = [];

    function emit() {
      const type = (head >> 4) & 7;
      const msg = { type, channel: (head >> 2) & 3, reply: !!(head & 2), extra: head & 1 };
      if (type === MSG.ADDRESS) {
        msg.display = data[0];
        msg.rejected = !!msg.extra;
      } else if (type === MSG.SPEED) {
        msg.speed = data[0] & 15;
        msg.dir = !!(data[0] & 16);
      } else if (type === MSG.FUNCTIONS) {
        msg.functions = FUNCTION_NAMES.map((n, i) => !!(data[0] & (1 << i)));
      } else if (type === MSG.STATE) {
        msg.display = data[0];
        msg.speed = data[1] & 15;
        msg.dir = !!(data[1] & 16);
        msg.functions = FUNCTION_NAMES.map((n, i) => !!(data[2] & (1 << i)));
        msg.stopped = !!msg.extra;
      } else if (type === MSG.STOPGO) {
        msg.stopped = !!msg.extra;
      } else if (type === MSG.NOTICE) {
        msg.unsupported = !!msg.extra;
      }
      head = null;
      data = [];
      onMessage(msg);
    }

    return bytes => {
      for (const b of bytes) {
        if (b & 0x80) {
          head = b; // a new message starts (an unfinished one before it is dropped)
          data = [];
          if (DATA_LENGTH[(b >> 4) & 7] === 0) emit();
        } else if (head !== null) {
          data.push(b);
          if (data.length === DATA_LENGTH[(head >> 4) & 7]) emit();
        }
      }
    };
  }

  // "43", "4_" or "--"
  function displayText(display) {
    if (display === DISPLAY_NONE || display === undefined) return '--';
    if (display >= DISPLAY_PENDING && display < DISPLAY_PENDING + 10) return `${display - DISPLAY_PENDING}_`;
    return String(display).padStart(2, '0');
  }

  global.RemoteProtocol = {
    CMD, MSG, DISPLAY_NONE, DISPLAY_PENDING, FUNCTION_NAMES,
    SPP_UUID: '00001101-0000-1000-8000-00805f9b34fb',
    command, parseCommand, describeCommand, encode, createDecoder, displayText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
