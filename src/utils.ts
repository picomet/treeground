import fs from "fs";
import https from "https";

export const sendMsgToServer = (ws: WebSocket, message: ClientMessage) => {
  return ws.send(JSON.stringify(message));
};

export const downloadFile = (url: string, dest: string) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
          file.on("error", (err) => {
            fs.unlinkSync(dest);
            reject(err);
          });
        } else if (response.statusCode === 302) {
          if (response.headers.location) {
            downloadFile(response.headers.location, dest)
              .then(resolve)
              .catch(reject);
          }
        } else {
          reject(new Error(`Server responded with ${response.statusCode}`));
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const getBaseName = (path: string) => {
  const parts = path.split("/");
  return parts[parts.length - 1];
};

export const aTryCatch = async <T>(
  fn: () => Promise<T>,
): Promise<[T | null, unknown | null]> => {
  try {
    const result = await fn();
    return [result, null];
  } catch (err) {
    return [null, err];
  }
};

export const createExec = (commands: string[]) => {
  return new Promise((resolve, reject) => {
    import("node:child_process")
      .then((cp) => {
        cp.exec(`bash -c "${commands.join(";")}"`, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            resolve(stdout);
          }
        });
      })
      .catch((err) => {
        reject(err);
      });
  });
};
