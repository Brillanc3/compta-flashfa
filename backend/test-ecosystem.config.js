module.exports = {
  apps: [{
    name: "cca-dev",
    script: "src/shards/master.js",
    exec_mode: "cluster",
    instances: 4,
    wait_ready: true,
    listen_timeout: 30000,
    kill_timeout: 10000,
    env: {
      MASTER_PORT: 9200,
      WEBSOCKET_PORT: 9204,
      BASE_SHARD_PORT: 9300,
      ENV: 'dev'
    }
  }]
};
