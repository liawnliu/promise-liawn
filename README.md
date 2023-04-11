# 用es6手写PromiseA+

## 初始化并测试

```bash
npm install
npm run test
```

## promises-aplus-tests

项目是已经安装了`promises-aplus-tests`，它有872个测试用例用于测试我们写的Promise是否符合PromiseA+规范。

可以用VSCode的远程资源管理器打开[promises-tests](https://github.com/promises-aplus/promises-tests)库，在测试不通过时可以读它的测试用例，以调整我们的代码。

**最后**：`./preomise/MyPromise.js`是不带注释的，`./preomise/MyPromise2.js`是带注释的，`./preomise/MyPromise3.js`是尝试加上`all`、`race`等方法的实现（没找到测试用例，自己也没自测，代码仅供参考）。如果代码中有问题或者需要讨论的，可以提交Issues。