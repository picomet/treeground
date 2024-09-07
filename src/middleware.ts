import { createMiddleware } from "@solidjs/start/middleware";
import fs from "fs";
import os from "os";
import path from "path";

const wasmDir = path.join(os.homedir(), ".cache", "treeground");

export default createMiddleware({
  onRequest: [
    (event) => {
      let url = new URL(event.request.url);
      if (
        url.pathname.match(/^(\/)tree-sitter(-[a-zA-Z]+.[a-z0-9]{6})?(\.wasm)$/)
      ) {
        let fileName = url.pathname.split("/").pop();
        if (fileName) {
          let location = path.join(wasmDir, fileName);
          if (fs.existsSync(location)) {
            return new Response(fs.readFileSync(location), {
              headers: {
                "Content-Type": "application/wasm",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
              },
            });
          }
        }
      }
    },
  ],
});
