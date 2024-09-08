// @refresh reload
import { StartServer, createHandler } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Treeground</title>
          <link
            rel="shortcut icon"
            type="image/ico"
            href="https://tree-sitter.github.io/tree-sitter/assets/images/favicon-32x32.png"
          />
          {assets}
        </head>
        <body class="bg-gray-100">
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
