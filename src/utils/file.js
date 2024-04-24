import sparkMd5 from "spark-md5"
const CHUNK_SIZE = 1 * 1024 * 1024; // 1M
// 将文件进行切片
export const createFileChunk = (file, size = CHUNK_SIZE) => {
  const chunks = []
  let cur = 0 
  while(cur < file.size) {
    chunks.push({ index: cur, file: file.slice(cur, cur+size)})
    cur += size
  }
  return chunks
}

/* 
计算整个文件的hash值,每个文件都有自己唯一的标识，
这个标识是将整个文件进行MD5加密，将加密后的Hash值作为文件的唯一标识
使用第三方库：spark-md5

hash的优化：
不一定非要hash整个文件
仅hash文件的第一个分片 + 中间分片的首尾n字节 + 最后一个分片
*/
export const calculateHashSample =  async (file) => {
  return new Promise((resolve)=> {
    let spark = new sparkMd5.ArrayBuffer()
    let fileReader = new FileReader()
    // hash的优化值：取前两块分片
    let offset = 2 * 1024 * 1024
    // 前面取2个分片
    let chunks = [file.slice(0, offset)]
    let cur = offset
    while(cur < file.size) {
      // 最后一片加入
      if(cur + offset >= file.size) {
        chunks.push(file.slice(cur, cur + offset))
      } else {
        // 中间分片，前中后取2个字节
        let mid = cur + offset/2
        let end = cur + offset
        chunks.push(file.slice(cur, cur + 2))
        chunks.push(file.slice(mid, mid + 2))
        chunks.push(file.slice(end - 2, end))
      }
      cur += offset
    }
    // 拼接在一起
    fileReader.readAsArrayBuffer(new Blob(chunks))
    fileReader.onload = (e) => {
      // 将当前分块的结果追加到spark对象中
      spark.append(e.target.result)
      // 全部读取，获取文件的hash
      resolve(spark.end())
    }
  })
}


