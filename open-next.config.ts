import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
  incrementalCache: "dummy",
  queue: "dummy"
});

config.buildCommand = "npm run build:next";

export default config;
