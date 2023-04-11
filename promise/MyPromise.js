const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

const myQueueMicroTask = (task) => {
  if (process && process.nextTick) {
    process.nextTick(task);
  } else if (MutationObserver) {
    const p = document.createElement("p");
    const observer = new MutationObserver(task);
    observer.observe(p, { childList: true });
    p.innerHTML = "test";
  } else if (queueMicrotask) {
    queueMicrotask(task);
  } else {
    setTimeout(task);
  }
}
const thenable = (param) => {
  if ((typeof param === 'object' && param != null) || typeof param === 'function') {
    const then = param.then;
    if (typeof then === 'function') {
      return then;
    }
  }
  return null;
}

class Mypromise {
  constructor(executor) {
    this._state = PENDING;
    this._value;
    this._reason;
    this._handlers = [];
    try {
      executor(this._resolve, this._reject)
    } catch (error) {
      this._reject(error)
    }
  }
  then(onResolved, onRejected) {
    let res, rej;
    const promise = new Mypromise((resolve, reject) => {
      res = resolve; 
      rej = reject;
    });
    this._pushHandler(FULFILLED, onResolved, res, rej, promise);
    this._pushHandler(REJECTED, onRejected, res, rej, promise);
    this._runHandlers();
    return promise;
  }
  _resolve = (value) => {
    this._changeState(FULFILLED, value);
  }
  _reject = (reason) => {
    this._changeState(REJECTED, reason);
  }
  _changeState(state, data) {
    if (this._state !== PENDING) return
    this._state = state;
    state === FULFILLED ? (this._value = data) : (this._reason = data)
    this._runHandlers();
  }
  _pushHandler(state, executor, resolve, reject, promise) {
    this._handlers.push({ state, executor, resolve, reject, promise });
  }
  _runHandlers() {
    if (this._state === PENDING) return
    while (this._handlers[0]) {
      const handler = this._handlers[0];
      this._runOneHandler(handler);
      this._handlers.shift();
    }
  }
  _runOneHandler({ state, executor, resolve, reject, promise }) {
    myQueueMicroTask(() => {
      if (state !== this._state) return
      if (typeof executor !== 'function') {
        this._state === FULFILLED ? resolve(this._value) : reject(this._reason);
        return
      }
      try {
        const rlt = executor(this._state === FULFILLED ? this._value : this._reason);
        this._handleExecutRlt(rlt, resolve, reject, promise);
      } catch (error) {
        reject(error)
      }
    })
  }
  _handleExecutRlt(rlt, resolve, reject, promise) {
    if (rlt === promise) return reject(new TypeError('Promise循环引用了，Promise/A+ 2.3.1'));

    let called;
    try {
      const then = thenable(rlt);
      if (then) {
        then.call(rlt, value => {
          if (called) return;
          called = true;
  
          this._handleExecutRlt(value, resolve, reject, promise);
        }, reason => {
          if (called) return;
          called = true;
          
          reject(reason);
        });
      } else {
        resolve(rlt);
      }
    } catch (error) {
      if (called) return;
      called = true;

      reject(error);
    }
  }
}
module.exports = Mypromise;