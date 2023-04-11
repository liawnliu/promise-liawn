const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

// 放入微队列
const myQueueMicroTask = (task) => {
  if (process && process.nextTick) {
    // node
    process.nextTick(task);
  } else if (MutationObserver) {
    // 浏览器
    const p = document.createElement("p");
    const observer = new MutationObserver(task);
    observer.observe(p, { childList: true });
    p.innerHTML = "test";
  } else if (queueMicrotask) {
    // 新API
    queueMicrotask(task);
  } else {
    // 最差的情况
    setTimeout(task);
  }
}
/**
 * 判断入参是否符合Promise形式，规则：param是普通对象或者函数，不能是基础类型，它有一个
 * then属性，该属性得是一个函数
 * @param {*} param 
 * @returns then或者null
 *  这个thenable有一种特殊形式，param.then抛错，此时调用thenable()的地方就应该try-catch处理
 *  Object.create(null, {
        then: {
            get: function () {
                throw reason;
            }
        }
    });
 */
const thenable = (param) => {
  if ((typeof param === 'object' && param != null) || typeof param === 'function') {
    // 单独取then，因为要过promises-aplus-tests的2.3.3.1检测，即只执行一次“param.then”
    const then = param.then;
    if (typeof then === 'function') {
      return then;
    }
  }
  return null;
}

class Mypromise {
  // Promise的构造函数入参是一个函数
  constructor(executor) {
    this._state = PENDING;
    this._value;
    this._reason;
    /* 
      同一个Promise对象可以多次调用then，它就会注册很多回调函数，那么就需要将这么多回调函数
      放到队列中等待处理
    */
    this._handlers = [];
    try {
      // executor立即执行的；executor内部的异步操作完成后，会用resolve或reject通知Promise
      executor(this._resolve, this._reject)
    } catch (error) {
      // executor执行可能会报错，例如用户写错语法，那我们自动帮它调用reject
      this._reject(error)
    }
  }
  /* 
    同一个Promise对象调用一次then，会注册两个回调函数，第一个回调函数是处理fulfilled的结
    果，第二个回调函数处理rejected的结果，then最终会返回一个新的Promise对象
  */
  then(onResolved, onRejected) {
    /* 
      新Promise对象的状态是由回调函数执行情况决定的，一般的，回调函数正常执行完那就调用
      新Promise对象的resolve，代码执行报错就会调用新Promise对象的reject
    */
    let res, rej;
    const promise = new Mypromise((resolve, reject) => {
      // 不能将_pushHandler放这里，原因是新promise没有完全生成，所以得放到new Mypromise后
      res = resolve; 
      rej = reject;
    });
    // onResolved和onRejected返回的对象不能是这个新promise，所以要将promise传进去
    this._pushHandler(FULFILLED, onResolved, res, rej, promise);
    this._pushHandler(REJECTED, onRejected, res, rej, promise);
    /*
      一般情况下，then会比异步先执行，也就是回调函数先注册好了，等待异步执行完就可以
      调用回调函数了，这完全没有问题。（先注册回调函数，后执行回调函数）
      但是有一种情况，就是executor内没有异步操作，直接resolve或reject了，然后执行链式
      调用then，这个时候才注册好回调函数。（先执行回调函数，后才注册回调函数，行不通）
      解决：在链式调用then注册好回调函数，就尝试执行一次回调函数，如果state是pending
      状态时就自动跳过执行。（注册回调函数，遇到pending跳过执行，等待状态改变再执行）
    */
    this._runHandlers(); // push后，也就是注册好回调函数，此时就尝试执行回调函数
    return promise;
  }
  // 异步成功，通知Promise改状态为fulfilled，记录异步结果
  _resolve = (value) => {
    this._changeState(FULFILLED, value);
  }
  // 异步异常，通知Promise改状态为rejected，记录异常原因
  _reject = (reason) => {
    this._changeState(REJECTED, reason);
  }
  _changeState(state, data) {
    // Promise改变状态时，只能由pending变为fulfilled或rejected
    if (this._state !== PENDING) return
    this._state = state;
    state === FULFILLED ? (this._value = data) : (this._reason = data)
    // 当Promise状态改变后，就会尝试去执行对应的回调函数（先注册回调函数，后执行回调函数）
    this._runHandlers();
  }
  _pushHandler(state, executor, resolve, reject, promise) {
    this._handlers.push({ state, executor, resolve, reject, promise });
  }
  _runHandlers() {
    // 要去处理回调了，但此时还是pending状态那就不处理(注册回调时，可能还在异步还是pending)
    if (this._state === PENDING) return
    // 每次从开头取一个出来处理，处理完后删除
    while (this._handlers[0]) {
      const handler = this._handlers[0];
      this._runOneHandler(handler);
      this._handlers.shift();
    }
  }
  _runOneHandler({ state, executor, resolve, reject, promise }) {
    // 放入微队列执行
    myQueueMicroTask(() => {
      // 状态匹配上才执行，此时状态只会是fulfilled或者rejected，只执行对应的回调
      if (state !== this._state) return
      // 如果不是函数，那么状态穿透，也就是将本Promise对象的状态直接交给新Promise对象
      if (typeof executor !== 'function') {
        // 意思是then前的Promise状态和结果，会作为then后新的Promise的状态和结果
        this._state === FULFILLED ? resolve(this._value) : reject(this._reason);
        return
      }
      try {
        // 是函数，还要分执行结果是普通值还是Promise
        const rlt = executor(this._state === FULFILLED ? this._value : this._reason);
        this._handleExecutRlt(rlt, resolve, reject, promise);
      } catch (error) {
        // 函数执行报错那就直接reject
        reject(error)
      }
    })
  }
  _handleExecutRlt(rlt, resolve, reject, promise) {
    // executor执行返回的结果不能是then返回的结果 Promise/A+ 2.3.1
    if (rlt === promise) return reject(new TypeError('Promise循环引用了，Promise/A+ 2.3.1'));

    let called;
    try {
      const then = thenable(rlt);
      /* 
        判断rlt是否是一个Promise形式，是的话就执行它的then，用then的执行情况决定是resolve
        还是reject。then执行后又是一个Promise形式，就继续解析，直到它是一个普通值。
      */
      if (then) {
        then.call(rlt, value => {
          // Promise/A+ 2.3.3.3.3 只能调用一次
          if (called) return;
          called = true;
  
          // 如果val还是一个Promise形式的，那么就递归处理它，直到是普通值
          this._handleExecutRlt(value, resolve, reject, promise);
        }, reason => {
          // Promise/A+ 2.3.3.3.3 只能调用一次
          if (called) return;
          called = true;
          
          reject(reason);
        });
      } else {
        // 是普通值，将这个执行结果包成新Promise供后面的人进行链式调用
        resolve(rlt);
      }
    } catch (error) {
      // Promise/A+ 2.3.3.3.3 只能调用一次
      if (called) return;
      called = true;

      reject(error);
    }
  }
}
module.exports = Mypromise;