<template>
  <div class="file-upload">
    <div class="file">
      <input type="file" name="file" @change="handleFileChange" />
    </div>
    <div class="upload">上传进度</div>
    <el-progress
      :text-inside="true"
      :stroke-width="20"
      :percentage="uploadProgress"
    ></el-progress>
    <div>使用webWorker计算hash</div>
    <el-progress
      :text-inside="true"
      :stroke-width="20"
      :percentage="hashProgress"
    ></el-progress>
    {{ hashProgress }}
    <div class="upload-btn">
      <el-button type="primary" @click="handleUpload">上传</el-button>
    </div>
  </div>
</template>
<script setup>
import { ElMessage } from "element-plus";
import { ref, computed } from "vue";
import request from "../utils/axios";
import { createFileChunk, calculateHashSample } from "../utils/file";
// import { createFileChunk } from "../utils/file";
const file = ref(null);
const chunksList = ref([]);
const hash = ref(null);
const hashProgress = ref(0);
const handleFileChange = (e) => {
  const fileUpload = e.target.files[0];
  if (!fileUpload) return;
  file.value = fileUpload;
};
const ext = (fileName) => {
  return fileName.split(".").pop();
};

// 使用web-worker: 多线程，异步处理，时间就是Math.max()
// const calculateHashWorker = async (chunks) => {
//   return new Promise((resolve) => {
//     // web-worker 防止卡顿主线程，创建文件分片worker
//     const worker = new Worker("/hash.js");
//     // 将文件通过postMessage发送给worker线程
//     worker.postMessage({ chunks });
//     // 分片处理完之后触发onmessage事件
//     worker.onmessage = (e) => {
//       // 获取处理结果
//       const { progress, hash } = e.data;
//       hashProgress.value = Number(progress.toFixed(2));
//       if (hash) {
//         resolve(hash);
//       }
//     };
//   });
// };
const handleUpload = async () => {
  if (!file.value) {
    return ElMessage.error("请选择文件");
  }
  // 第一步：将文件进行切片,并计算整个文件的hash值
  let chunks = createFileChunk(file.value);
  console.error(4, chunks);
  // 优化一：hash值使用抽样
  hash.value = await calculateHashSample(file.value);
  // hash.value = await calculateHashWorker(chunks);

  // 第二步发送请求，询问服务端文件的上传状态
  const { uploaded, uploadedList } = await request.post("/check", {
    ext: ext(file.value.name),
    hash: hash.value,
  });
  if (uploaded) {
    return ElMessage.success("秒传: 上传成功");
  }
  console.error(111, uploaded, uploadedList);

  // 第三步： 根据文件上传状态进行后续上传
  /**
   * （1）文件已经上传过了：结束---秒传功能
   * （2）文件存在，但分片不完整： 断点续传功能（计算未上传的分片序列并上传对应分片）
   * （3）文件不存在： 将所有分片上传
   */
  // 修改上传的数据类型,将所有的切片重新命名
  chunksList.value = chunks.map((chunk, index) => {
    // 每个切片的名字
    const chunkName = hash.value + "-" + index;
    return {
      hash: hash.value,
      chunk: chunk.file,
      name: chunkName,
      index,
      // 进度条
      progress: uploadedList.indexOf(chunkName) > -1 ? 100 : 0,
    };
  });
  // 断点续传的功能
  await uploadChunks(uploadedList);
};
// 断点续传的功能
// 请求不仅包含文件，还包含分片索引以及hash值，需要是formData
const uploadChunks = async (uploadedList = []) => {
  const list = chunksList.value
    .filter((chunk) => uploadedList.indexOf(chunk.name) == -1)
    .map(({ hash, chunk, name, index }) => {
      const form = new FormData();
      form.append("chunkname", name);
      form.append("hash", hash);
      form.append("file", chunk);
      form.append("ext", ext(file.value.name));
      return { form, index, error: 0, progress: 0 };
    });
  console.error(32, list.length);
  try {
    await sendRequest([...list], 4);
    // 通知后端进行合并
    if (list.length + uploadedList.length === chunksList.value.length) {
      await mergeRequest();
    }
  } catch (e) {
    ElMessage.error("上传出了点小问题");
  }
};
// 切片上传，并做错误处理
const sendRequest = (chunks, limit = 4) => {
  return new Promise((resolve, reject) => {
    const len = chunks.length;
    let counter = 0;
    // 全局开关
    let isStop = false;
    // 递归函数，每片每片上传
    const start = async () => {
      if (isStop) return;
      const task = chunks.shift();
      if (task) {
        const { form, index } = task;
        console.error(3, task, index, chunks);
        try {
          await request.post("/upload", form, {
            onUploadProgress: (progress) => {
              console.error(98, chunks[index]);
              console.error(2, progress);
              if (chunks[index]) {
                chunks[index].progress = Number(
                  ((progress.loaded / progress.total) * 1000).toFixed(2)
                );
              }
            },
          });
          console.error(334, counter);
          if (counter === len - 1) {
            resolve();
          } else {
            counter++;
            start();
          }
        } catch (e) {
          console.log("出错了");
          if (chunks[index]) {
            chunks[index].progress = -1;
          }

          if (task.error < 3) {
            task.error++;
            // 重新进入
            chunks.unshift(task);
            start();
          } else {
            // 错误三次，直接结束
            isStop = true;
            reject();
          }
        }
      }
    };
    while (limit > 0) {
      setTimeout(() => {
        start();
      }, Math.random() * 2000);

      limit -= 1;
    }
  });
};
// 合并操作
const mergeRequest = async () => {
  await request.post("/merge", {
    ext: ext(file.value.name),
    size: 1 * 1024 * 1024,
    hash: hash.value,
  });
};

const uploadProgress = computed(() => {
  if (!file.value || !chunksList.value.length) return 0;
  const loaded = chunksList.value
    .map((item) => item.chunk.size * item.progress)
    .reduce((acc, cur) => acc + cur);
  return parseInt((loaded / file.value.size).toFixed(2));
});
</script>
<style lang="less" scoped>
.file-upload {
  & .file {
    height: 100px;
    border: 2px dashed #eee;
    line-height: 100px;
    text-align: center;
    vertical-align: middle;
  }
  & .upload {
    font-size: 16px;
    margin: 20px 0;
    text-align: left;
    &-btn {
      margin: 20px 0;
    }
  }
}
</style>
