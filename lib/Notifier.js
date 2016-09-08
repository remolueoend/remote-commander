
const __conns = {};

function addConn(username, socket) {
  __conns[username] = __conns[username] || [];
  __conns[username].push(socket);

  socket.on('disconnect', () => {
    if(__conns[username] instanceof Array) {
      const si = __conns[username].indexOf(socket);
      if(si !== -1) __conns[username].splice(si, 1);
    }
  });
}

class CmdNotification {
  constructor(username, cmd) {
    this.user = username;
    this.cmd = cmd;
  }

  attachStreams(out, err) {
    this.attachStream(out, 'stdout');
    this.attachStream(err, 'stderr');
  }

  attachStream(stream, type) {
    stream.on('data', chunk => {
      this.cmdUpdate(chunk, type === 'stderr');
    });

    stream.on('error', () => {});
  }

  cmdUpdate(message, err) {
    this.notify('stdo', {
      err: err,
      message: message.toString(),
      name: this.cmd.name
    });
  }

  notify(event, data) {
    if(__conns[this.user] instanceof Array) {
      for (let s of __conns[this.user]) {
        s.emit(event, data);
      }
    }
  }

  send(message, err) {
    this.cmdUpdate(message, err);
  }

  sendExit(id) {
    this.notify('exit', {
      name: this.cmd.name,
      id: id
    });
  }
}

module.exports = {addConn, CmdNotification};