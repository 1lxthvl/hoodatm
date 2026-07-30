import { loadConfig } from "./config.js";
import { Store } from "./db.js";

const config = loadConfig();
const store = new Store(config.databaseUrl);

try {
  await store.migrate();
  console.log("holding-indexer migrations applied");
} finally {
  await store.close();
}
