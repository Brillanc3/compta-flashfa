module.exports = {
  apps: [
    {
      name: "cca",
      script: "src/shards/master.js",
      exec_mode: "cluster",
      instances: 4,
      wait_ready: true,
      listen_timeout: 120000,
      kill_timeout: 15000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: 15000,
      out_file: "logs/master-prod-out.log",
      error_file: "logs/master-prod-err.log",
      merge_logs: true,
      env: {
        MASTER_PORT: 9100,
        WEBSOCKET_PORT: 9104,
        BASE_SHARD_PORT: 9110,
        ENV: 'prod'
      }
    },
    {
      name: "ingest-worker",
      script: "src/lib/ingestWorker.js",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      kill_timeout: 10000,
      out_file: "logs/ingest-worker-out.log",
      error_file: "logs/ingest-worker-err.log",
      env: {
        ENV: 'prod'
      }
    }
  ]
};
