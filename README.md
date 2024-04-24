# file-upload

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).


### 文件上传
优化点
（1）文件大时，计算hash值十分耗时，对于一个 2GB 大小的文件来说，即使是使用 MD5 算法来计算 Hash 值，也会造成浏览器的卡顿。
解决hash计算耗时问题：
（1）使用Web Worker,不占用主线程资源
（2）不一定非要hash整个文件，仅hash文件的第一个分片 + 中间分片的首尾n字节 + 最后一个分片


上传切片的时候，所有的文件切片一起使用 Promise.all 发起几十个 HTTP 请求，也会导致卡顿，所以我们就需要手动管理上传任务的并发数量。

### 箭头函数和普通函数的适用场景
(1) 箭头函数适用于那些简短、简洁、明确的函数

### 前端和后端连接
vue.config.js中使用proxy

### 参考链接
https://juejin.cn/post/7360980866796306442

