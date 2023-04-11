const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

const myQueueMicrotask = task => {
  if (process && process.nextTick) {
    process.nextTick(task);
  } else if (MutationObserver) {
    const p = document.createElement('p');
    const observer = new MutationObserver(task);
    observer.observe(p, { childList: true });
    p.innerHTML = '1';
  } else if (queueMicrotask) {
    queueMicrotask(task);
  } else {
    setTimeout(task);
  }
}
const thenable = param => {
  if ((param !== null && typeof param === 'object') || typeof param === 'function') {
    const then = param.then;
    if (typeof then === 'function') {
      return then
    }
  }
}

class MyPromise {
  constructor(executor) {
    this._state = PENDING;
    this._value;
    this._reason;
    this._handlers = [];
    try {
      executor(this._resolve, this._reject)
    } catch (error) {
      this._reject(error);
    }
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
    state === FULFILLED ? (this._value = data) : (this._reason = data);
    this._runHandlers();
  }
  then(onResolved, onRejected) {
    let res, rej;
    const promise = new MyPromise((resolve, reject) => {
      res = resolve, rej = reject;
    });
    this._pushHandler(FULFILLED, onResolved, res, rej, promise);
    this._pushHandler(REJECTED, onRejected, res, rej, promise);
    this._runHandlers();
    return promise;
  }
  _pushHandler(state, executor, resolve, reject, promise) {
    this._handlers.push({ state, executor, resolve, reject, promise });
  }
  _runHandlers() {
    if (this._state === PENDING) return
    while(this._handlers[0]) {
      const handle = this._handlers[0];
      this._runOneHandler(handle);
      this._handlers.shift();
    }
  }
  _runOneHandler({ state, executor, resolve, reject, promise }) {
    myQueueMicrotask(() => {
      if (state !== this._state) return
      if (typeof executor !== 'function') {
        state === FULFILLED ? resolve(this._value) : reject(this._reason);
        return
      }
      try {
        const rlt = executor(state === FULFILLED ? this._value : this._reason);
        this._handleRlt(rlt, resolve, reject, promise);
      } catch (error) {
        reject(error);
      }
    })
  }
  _handleRlt(rlt, resolve, reject, promise) {
    if (rlt === promise) return reject(new TypeError('promise循环引用了'));
    let called;
    try {
      const then = thenable(rlt);
      if (then) {
        then.call(rlt, val => {
          if(called) return
          called = true
          this._handleRlt(val, resolve, reject, promise)
        }, reason => {
          if(called) return
          called = true
          reject(reason);
        });
      } else {
        resolve(rlt);
      }
    } catch (error) {
      if(called) return
      called = true
      reject(error);
    }
  }
  catch(onRejected) {
    let res, rej;
    const promise = new MyPromise((resolve, reject) => {
      res = resolve, rej = reject;
    });
    this._pushHandler(REJECTED, onRejected, res, rej, promise);
    this._runHandlers();
    return promise;
  }
  finally(onFinished) {
    return this.then(value => {
      onFinished(); // 执行回调，接收和返回的数据都不做处理
      return value;
    }, reason => {
      onFinished(); // 执行回调，接收和返回的数据都不做处理
      throw reason;
    })
  }
  static resolve(param) {
    return new MyPromise((resolve, reject) => {
      resolve(param)
    });
  }
  static reject(param) {
    return new MyPromise((resolve, reject) => {
      reject(param)
    });
  }
  // 等到所有的 promise 对象都成功或有任意一个 promise 失败。
  static all(params) {
    return new MyPromise((resolve, reject) => {
      try {
        let count = 0;
        let fulfilledCount = 0;
        const rlt = [];
        for (const p of params) {
          const i = count;
          count ++;
          MyPromise.resolve(p).then(val => {
            rlt[i];
            if (++fulfilledCount === count) {
              resolve(rlt)
            }
          }, reject)
        }
        if (!count) resolve([]);
      } catch (error) {
        reject(error);
      }
    });
  }
  // 等到任意一个 promise 的状态变为已敲定。
  static race(params) {
    return new MyPromise((resolve, reject) => {
      try {
        for (const p of params) {
          MyPromise.resolve(p).then(resolve, reject);
        }
        // 如果是[]，就永远pending
      } catch (error) {
        reject(error);
      }
    });
  }
  // 等到所有 promise 都已敲定（每个 promise 都已兑现或已拒绝）
  static allSettled(params) {
    return new MyPromise((resolve, reject) => {
      try {
        let count = 0;
        let settledCount = 0;
        const rlt = [];
        for (const p of params) {
          const i = count;
          count ++;
          MyPromise.resolve(p).then(value => {
            rlt[i] = { state: FULFILLED, value }
            if (++settledCount === count) {
              resolve(rlt);
            }
          }, reason => {
            rlt[i] = { state: REJECTED, reason }
            if (++settledCount === count) {
              resolve(rlt);
            }
          })
        }
        if (!count) resolve([]);
      } catch (error) {
        reject(error);
      }
    });
  }
  // 任意一个 promise 变成了兑现状态那就返回已兑现的promise，
  // 最终都没有兑现，那就返回拒绝的promise
  static any(params) {
    return new MyPromise((resolve, reject) => {
      try {
        let count = 0;
        let handleCount = 0;
        const errors = []
        for (const p of params) {
          const i = count;
          count++;
          MyPromise.resolve(p).then(resolve, () => {
            errors[i] = new Error('xxx');
            if (++handleCount === count) {
              reject(new AggregateError({
                name: 'AggregateError',
                message: 'All Promises rejected',
                errors
              }));
            }
          });
        }
        if (!count) {
          reject(new AggregateError({
            name: 'AggregateError',
            message: 'params is empty',
            errors: []
          }));
        }
      } catch (error) {
        reject(error)
      }
    });
  }
}
module.exports = MyPromise;
