import chokidar from "chokidar";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { Party } from "vinxi/dist/types/types/party";
import { partyHandler } from "vinxi/party";
import yoctoSpinner from "yocto-spinner";
import zlib from "zlib";

import {
  aTryCatch,
  createExec,
  downloadFile,
  getGrmrUniqueName,
} from "./utils";

let grammars: string[] = [];

const watcher = chokidar.watch([], {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
});

const builds: { [key: string]: NodeJS.Timeout } = {};

const localDir = path.join(os.homedir(), ".local");
const tsCliPath = path.join(localDir, "bin", "tree-sitter");
const cacheDir = path.join(os.homedir(), ".cache");
const tgDir = path.join(cacheDir, "treeground");
const tsWasmPath = path.join(tgDir, "tree-sitter.wasm");
const emsdkDest = path.join(localDir, "emsdk");

var tsCliStatus: TsCliStatus = fs.existsSync(tsCliPath)
  ? "downloaded"
  : "unset";
var tsWasmStatus: TsWasmStatus = fs.existsSync(tsWasmPath)
  ? "downloaded"
  : "unset";
var emsdkStatus: EmsdkStatus = fs.existsSync(emsdkDest) ? "setuped" : "unset";

export default partyHandler({
  onConnect(party, con) {
    watcher.removeAllListeners("change");
    watcher.on("change", (filePath) => {
      for (const folder of grammars) {
        if (filePath.startsWith(folder)) {
          if (path.basename(filePath) === "grammar.js") {
            clearTimeout(builds[folder]);
            builds[folder] = setTimeout(() => {
              buildWasm(folder)
                .then((output) => {
                  const message: ServerMessage = {
                    type: "load",
                    grammar: folder,
                  };
                  party.broadcast(JSON.stringify(message));
                })
                .catch((err) => {
                  console.log(err);
                });
            }, 500);
          }
        }
      }
    });
  },
  onMessage(party, message, con) {
    let msg = JSON.parse(message) as ClientMessage;
    if (msg.type === "tsCliCheck") {
      sendMessageToClient(party, {
        type: "tsCliStatus",
        status: tsCliStatus,
      });
    } else if (msg.type === "tsCliDownload") {
      if (tsCliStatus !== "downloading") {
        const matrix = {
          platform: {
            darwin: {
              name: "macos",
              arch: {
                arm64: { name: "arm64" },
                x64: { name: "x64" },
              },
            },
            linux: {
              name: "linux",
              arch: {
                arm64: { name: "arm64" },
                arm: { name: "arm" },
                x64: { name: "x64" },
                x86: { name: "x86" },
                ppc64: { name: "powerpc64" },
              },
            },
            win32: {
              name: "windows",
              arch: {
                arm64: { name: "arm64" },
                x64: { name: "x64" },
                x86: { name: "x86" },
                ia32: { name: "x86" },
              },
            },
          },
        };

        const platform =
          matrix.platform[process.platform as keyof typeof matrix.platform];
        const arch = platform?.arch[process.arch as keyof typeof platform.arch];

        if (!platform || !platform.name || !arch || !arch.name) {
          tsCliStatus = "error";
          sendMessageToClient(party, {
            type: "tsCliStatus",
            status: tsCliStatus,
          });
        } else {
          tsCliStatus = "downloading";
          sendMessageToClient(party, {
            type: "tsCliStatus",
            status: tsCliStatus,
          });
          let spinner = yoctoSpinner({
            text: "Downloading tree-sitter-cli",
            color: "yellow",
          }).start();
          const releaseURL = `https://github.com/tree-sitter/tree-sitter/releases/download/${msg.version}`;
          const zipURL = `${releaseURL}/tree-sitter-${platform.name}-${arch.name}.gz`;
          https.get(zipURL, (res) => {
            if (res.statusCode === 302 && res.headers.location) {
              const url = res.headers.location;
              https.get(url, (res) => {
                if (res.statusCode === 200) {
                  const file = fs.createWriteStream(tsCliPath);
                  res.pipe(zlib.createGunzip()).pipe(file);
                  file.on("finish", () => {
                    file.close(() => {
                      fs.chmodSync(tsCliPath, "755");
                      tsCliStatus = "downloaded";
                      sendMessageToClient(party, {
                        type: "tsCliStatus",
                        status: tsCliStatus,
                      });
                      spinner.success("Downloaded tree-sitter-cli");
                    });
                  });
                  res.on("error", (err) => {
                    fs.unlinkSync(tsCliPath);
                    tsCliStatus = "error";
                    sendMessageToClient(party, {
                      type: "tsCliStatus",
                      status: tsCliStatus,
                    });
                    spinner.success("Failed to download tree-sitter-cli");
                    console.log(err);
                  });
                }
              });
            }
          });
        }
      }
    } else if (msg.type === "tsWasmCheck") {
      sendMessageToClient(party, {
        type: "tsWasmStatus",
        status: tsWasmStatus,
      });
    } else if (msg.type === "tsWasmDownload") {
      if (tsWasmStatus !== "downloading") {
        tsWasmStatus = "downloading";
        sendMessageToClient(party, {
          type: "tsWasmStatus",
          status: tsWasmStatus,
        });
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir);
        }
        if (!fs.existsSync(tgDir)) {
          fs.mkdirSync(tgDir);
        }
        let spinner = yoctoSpinner({
          text: "Downloading tree-sitter.wasm",
          color: "yellow",
        }).start();
        downloadFile(
          `https://github.com/tree-sitter/tree-sitter/releases/download/${msg.version}/tree-sitter.wasm`,
          tsWasmPath,
        )
          .then(() => {
            tsWasmStatus = "downloaded";
            sendMessageToClient(party, {
              type: "tsWasmStatus",
              status: tsWasmStatus,
            });
            spinner.success("Downloaded tree-sitter.wasm");
          })
          .catch((err) => {
            tsWasmStatus = "error";
            sendMessageToClient(party, {
              type: "tsWasmStatus",
              status: tsWasmStatus,
            });
            spinner.error("Failed to download tree-sitter.wasm");
            console.log(err);
          });
      }
    } else if (msg.type === "emsdkCheck") {
      sendMessageToClient(party, {
        type: "emsdkStatus",
        status: emsdkStatus,
      });
    } else if (msg.type === "emsdkDownload") {
      if (emsdkStatus !== "downloading") {
        emsdkStatus = "downloading";
        sendMessageToClient(party, {
          type: "emsdkStatus",
          status: emsdkStatus,
        });
        (async () => {
          var commands = [
            `cd ${localDir}`,
            "git clone https://github.com/emscripten-core/emsdk --depth 1",
          ];
          var spinner = yoctoSpinner({
            text: "Cloning emsdk",
            color: "yellow",
          }).start();
          var [res, err] = await aTryCatch(() => createExec(commands));
          if (err == null) {
            spinner.success("Cloned emsdk");
          } else {
            spinner.error("Failed to clone emsdk");
            console.log(err);
            emsdkStatus = "error";
            sendMessageToClient(party, {
              type: "emsdkStatus",
              status: emsdkStatus,
            });
          }

          var commands = [`cd ${emsdkDest}`, "./emsdk install latest"];
          var spinner = yoctoSpinner({
            text: "Downloading latest sdk",
            color: "yellow",
          }).start();
          var [res, err] = await aTryCatch(() => createExec(commands));
          if (err == null) {
            spinner.success("Downloaded latest sdk");
          } else {
            emsdkStatus = "error";
            sendMessageToClient(party, {
              type: "emsdkStatus",
              status: emsdkStatus,
            });
            spinner.error("Failed to install emsdk");
            console.log(err);
          }

          var commands = [`cd ${emsdkDest}`, "./emsdk activate latest"];
          var spinner = yoctoSpinner({
            text: "Activating latest sdk",
            color: "yellow",
          }).start();
          var [res, err] = await aTryCatch(() => createExec(commands));
          if (err == null) {
            emsdkStatus = "setuped";
            sendMessageToClient(party, {
              type: "emsdkStatus",
              status: emsdkStatus,
            });
            spinner.success("Activated latest sdk");
          } else {
            emsdkStatus = "error";
            sendMessageToClient(party, {
              type: "emsdkStatus",
              status: emsdkStatus,
            });
            spinner.error("Failed to activate emsdk");
            console.log(err);
          }
        })();
      }
    } else if (msg.type === "add") {
      if (fs.existsSync(msg.folder)) {
        buildWasm(msg.folder)
          .then((output) => {
            if (!grammars.includes(msg.folder)) {
              grammars.push(msg.folder);
              watcher.add(msg.folder);
            }
            sendMessageToClient(party, {
              type: "load",
              grammar: path.basename(msg.folder),
            });
          })
          .catch((err) => {
            console.log(err);
          });
      }
    } else if (msg.type === "watch") {
      for (const folder of msg.folders) {
        if (!grammars.includes(folder)) {
          grammars.push(folder);
          watcher.add(folder);
        }
      }
    }
  },
});

async function buildWasm(folder: string) {
  let outFolder = path.join(os.homedir(), ".cache", "treeground");
  if (!fs.existsSync(outFolder)) {
    fs.mkdirSync(outFolder);
  }
  let output = path.join(outFolder, `${getGrmrUniqueName(folder)}.wasm`);
  const localDir = path.join(os.homedir(), ".local");
  const emsdk = path.join(localDir, "emsdk");
  var commands = [`cd ${folder}`, "tree-sitter generate"];
  var spinner = yoctoSpinner({
    text: "Generating parser...",
    color: "yellow",
  }).start();
  var [res, err] = await aTryCatch(() => createExec(commands));
  if (err == null) {
    spinner.success("Generated parser.");
  } else {
    spinner.error("Failed to generate parser.");
    throw err;
  }
  var commands = [
    `cd ${folder}`,
    `source ${path.join(emsdk, "emsdk_env.sh")}`,
    `tree-sitter build --wasm --output ${output}`,
  ];
  var spinner = yoctoSpinner({
    text: "Building wasm...",
    color: "yellow",
  }).start();
  var [res, err] = await aTryCatch(() => createExec(commands));
  if (err == null) {
    spinner.success("Built wasm.");
  } else {
    spinner.error("Failed to build wasm.");
    throw err;
  }
}

function sendMessageToClient(party: Party, message: ServerMessage) {
  party.broadcast(JSON.stringify(message));
}
