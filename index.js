/*
 * @Author: 徐凯 xukai@sinoroad.com
 * @Date: 2023-03-25 14:25:19
 * @Description:
 */
const ftp = require("ftp"); //连接FTP
const path = require("path");
const client = new ftp();
const fs = require("fs");

//本地文件夹路径；
let localDirPath = "dist/";
//远程地址，打开ftp以后的地址，不需要加入host；
let remotePath = "/test/";
const uploadFiles = [];
const mkDirPromiseArr = [];

async function start(callback) {
  const { err: ea, dir } = await cwd(remotePath); //此处应对err做处理
  if (ea) {
    client.mkdir(remotePath, true, (err) => {
      if (err) {
        console.log("创建" + remotePath + "文件夹失败");
        upload();
      } else {
        console.log("创建" + remotePath + "成功");
        upload();
      }
    });
  } else {
    upload();
  }

  function upload() {
    const filesPath = { files: [] };
    getDirAllFilePath(localDirPath, filesPath);
    console.log(filesPath);
    remoteMkDir(filesPath, "");
    console.log("准备上传...");
    setTimeout(() => {
      Promise.all(mkDirPromiseArr).then(() => {
        console.log("开始上传...");
        const tasks = uploadFile();
        runPromiseArray(tasks).then(() => {
          client.end();
          callback()
          console.warn("上传完成～");
        });
      });
    }, 3000);
  }
}

// 获取本地的文件地址和路径;
function getDirAllFilePath(paths, parent) {
  const files = fs.readdirSync(paths);
  files.forEach((item) => {
    if (item != ".DS_Store") {
      const path = `${paths}/${item}`;
      if (isDir(path)) {
        getDirAllFilePath(path, (parent[item] = { files: [] }));
      } else if (isFile(path)) {
        parent.files.push(item);
      }
    }
  });
}

//创建远程确实的文件夹；
async function remoteMkDir(obj, _path) {
  for (const key in obj) {
    if (key === "files") {
      for (let i = 0, len = obj[key].length; i < len; i++) {
        const promise = new Promise(async (resolve) => {
          let p = "";
          if (_path) {
            p = _path + "/";
          }
          const filePathName = p + obj[key][i];
          uploadFiles.push({ path: filePathName, fileName: obj[key][i] });
          const ph =
            remotePath +
            filePathName.substring(0, filePathName.lastIndexOf("/") + 1);
          let { err: ea, dir } = await cwd(ph); //此处应对err做处理
          if (ea) {
            client.mkdir(ph, true, (err) => {
              if (err) {
                console.log("mkdir" + ph + "err", err);
                resolve(null);
                return;
              }
              console.log("mkdir " + ph + "  success");
              resolve(null);
            });
          } else {
            resolve(null);
          }
        });

        mkDirPromiseArr.push(promise);
      }
    } else {
      let p = "";
      if (_path) {
        p = _path + "/";
      }
      remoteMkDir(obj[key], p + key);
    }
  }
}

//上传文件；
function uploadFile() {
  const tasks = [];
  const resourcesPath = localDirPath;
  //目标路径文件夹;
  const checkPath = remotePath;
  for (let i = 0, len = uploadFiles.length; i < len; i++) {
    const task = () => {
      return new Promise(async (resolve, reject) => {
        const _path = uploadFiles[i].path;
        const targetPath = checkPath + _path;
        const putPath = resourcesPath + "/" + _path;
        const dirpath = path.dirname(targetPath);
        const fileName = path.basename(targetPath);

        client.cwd(dirpath, (cwdErr, dir) => {
          client.pwd((pwdErr, cwd) => {
            if (pwdErr) {
              resolve(pwdErr);
            } else {
              const rs = fs.createReadStream(putPath);
              client.put(rs, fileName, (putErr, data) => {
                if (putErr) {
                  resolve(err);
                } else {
                  console.log(targetPath + "文件上传成功");
                  resolve(true);
                }
              });
              // client.get(fileName, (err, res) => {
              //     if (res) {
              //         console.log(`${targetPath} =====================已经存在了`);
              //         resolve(true);
              //     } else {
              //         const rs = fs.createReadStream(putPath);
              //         client.put(rs, fileName, (putErr, data) => {
              //             if (putErr) {
              //                 resolve(err);
              //             } else {
              //                 console.log(targetPath + '文件上传成功');
              //                 resolve(true);
              //             }
              //         })
              //     }
              // });
            }
          });
        });
      });
    };
    tasks.push(task);
  }
  return tasks;
}

//执行Promise的队列动作;
function runPromiseArray(parray) {
  //这个方法可以放到G里
  let p = Promise.resolve();
  for (let promise of parray) {
    p = p.then(promise);
  }
  return p;
}

//切换目录
async function cwd(dirpath) {
  return new Promise((resolve, reject) => {
    client.cwd(dirpath, (err, dir) => {
      resolve({ err: err, dir: dir });
    });
  });
}

function isFile(filepath) {
  //判断是否是文件 Boolean
  let stat = fs.statSync(filepath);
  return stat.isFile();
}

function isDir(filepath) {
  //判断是否是文件夹 Boolean
  let stat = fs.statSync(filepath);
  return stat.isDirectory();
}

function apply(options, compiler) {
  compiler.plugin("after-emit", function (compilation, callback) {
    console.log("The compilation is going to handle files...");
    // 本地文件夹路径；
    options.localPath && (localDirPath = options.localPath)
    // 远程地址，打开ftp以后的地址，不需要加入host；
    options.remotePath && (remotePath = options.remotePath)

    const connectionProperties = {
      host: options.host,
      user: options.user,
      password: options.password,
      port: options.port,
    };
    client.connect(connectionProperties);
    client.on("ready", () => {
      console.log("ftp client is ready");
      start(callback);
    });
  });
}

module.exports = function (options) {
  // validate the options
  if (!options.host) {
    throw new Error("host is required!");
  } else if (!options.user) {
    throw new Error("user is required!");
  } else if (!options.password) {
    throw new Error("password is required!");
  } else if (!options.port) {
    throw new Error("port is required!");
  }
  return {
    apply: apply.bind(this, options),
  };
};
