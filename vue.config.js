const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api/': {
        target: "http://localhost:7001",
        secure:false,
        pathRewrite:{
          '^/api':''
        }
      }
    }
  }
})
