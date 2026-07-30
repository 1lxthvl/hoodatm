const path = require("node:path");

const standaloneRoot = path.join(__dirname, ".next", "standalone");

process.chdir(standaloneRoot);
require(path.join(standaloneRoot, "server.js"));
