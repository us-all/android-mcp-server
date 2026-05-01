import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listDevices, getDeviceInfo } from "./tools/device.js";

/**
 * MCP Resources for hot Android entities.
 * URI scheme: `android://`
 *   - android://devices             — list of connected devices
 *   - android://device/{serial}     — device details by serial
 */

function asJson(uri: string, data: unknown) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    "devices",
    "android://devices",
    {
      title: "Connected Android Devices",
      description: "All connected Android devices and emulators",
      mimeType: "application/json",
    },
    async (uri) => {
      const data = await listDevices();
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "device",
    new ResourceTemplate("android://device/{serial}", { list: undefined }),
    {
      title: "Android Device Info",
      description: "Detailed device info (model, brand, Android version, display) by serial",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await getDeviceInfo({ serial: String(vars.serial) });
      return asJson(uri.toString(), data);
    },
  );
}
