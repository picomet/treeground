#!/usr/bin/env node
import path from "node:path";

process.env.PORT = 7533;
process.env.HOST = "localhost";

import(
  path.join(path.dirname(import.meta.url), ".output", "server", "index.mjs")
);
