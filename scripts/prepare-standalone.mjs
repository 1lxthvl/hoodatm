import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = join(projectRoot, ".next", "standalone");
const standaloneNextRoot = join(standaloneRoot, ".next");

await mkdir(standaloneNextRoot, { recursive: true });

const publicTarget = join(standaloneRoot, "public");
const staticTarget = join(standaloneNextRoot, "static");

await rm(publicTarget, { recursive: true, force: true });
await rm(staticTarget, { recursive: true, force: true });

await cp(join(projectRoot, "public"), publicTarget, { recursive: true });
await cp(join(projectRoot, ".next", "static"), staticTarget, { recursive: true });
