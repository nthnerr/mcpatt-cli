# mcpatt-cli 

`mcpatt-cli` [Model Context Protocol Audit Trail Tool - Command Line Interface] is a local stdio proxy for the Model Context Protocol (MCP). It intercepts bidirectional JSON-RPC 2.0 messages between an AI client and an MCP server, logging payloads to the terminal in real time and writing session histories to disk.

---

## Distribution

* **Current Version:** 1.0.24
* **Format:** Claude `.mcpb` file bundle

---

## Configuration

To use the proxy, update your MCP client configuration by injecting `mcpatt-cli` ahead of your target server command.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "mcpatt-cli",
        "--name", "filesystem",
        "--",
        "@modelcontextprotocol/server-filesystem", "/home/user"
      ]
    }
  }
}

```

---

## Reference

### CLI Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--name` | string | *Required* | Label for the target server. Used for terminal output and log naming.|
| `--json-only` | boolean | `false` | Suppresses terminal output; writes the JSON log file only.|
| `--no-file` | boolean | `false` | Suppresses the JSON file; prints to terminal only.|
| `--truncate N` | integer | `500` | Terminal character truncation limit for large outputs.|

---

## Output Examples

### Terminal Stream

Longer outputs are truncated locally to preserve readability.

```text
◆ MCPATT-CLI session started
  Server  : filesystem
  Log file: ./mcpatt-filesystem-1750197240.json

→ [22:14:05] filesystem read_file
  Input: { "path": "/home/user/src/index.ts" }

← [22:14:05] filesystem read_file (143ms)
  Output: "import { Server } from @modelcontextprotocol..." [+4821 chars truncated]

```

### JSON Log File

Stored as `./mcpatt-[name]-[timestamp].json`. Contains full, untruncated payloads paired by message identifier.

```json
{
  "session_id": "1750197240",
  "server_name": "filesystem",
  "started_at": "2026-06-17T22:14:00.000Z",
  "ended_at": "2026-06-17T22:14:09.000Z",
  "total_calls": 2,
  "calls": [
    {
      "id": 1,
      "tool": "read_file",
      "input": { "path": "/home/user/src/index.ts" },
      "output": "import { Server } from \"@modelcontextprotocol/sdk/server/index.js\";\n...",
      "duration_ms": 143,
      "timestamp": "2026-06-17T22:14:05.123Z",
      "error": null
    }
  ]
}

```

---

## License

MIT