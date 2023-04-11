const MyPromise = require('./promise/MyPromise3.js');

MyPromise.deferred = function () {
  let result = {};
  result.promise = new MyPromise((resolve, reject) => {
      result.resolve = resolve;
      result.reject = reject;
  });
  return result;
}
module.exports = MyPromise;