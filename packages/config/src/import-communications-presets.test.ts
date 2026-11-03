import { describe, expect, it } from "vitest";

import { buildCommunicationsPresetColumnMapping } from "./import-communications-presets.js";

describe("import-communications-presets", () => {
  it("maps common communications export headers", () => {
    const mapping = buildCommunicationsPresetColumnMapping([
      "Message ID",
      "Customer ID",
      "Channel",
      "Direction",
      "To",
      "Body",
      "Sent At",
    ]);

    expect(mapping).toMatchObject({
      "Message ID": "sourceId",
      "Customer ID": "customerSourceId",
      Channel: "channel",
      Direction: "direction",
      To: "toAddress",
      Body: "body",
      "Sent At": "sentAt",
    });
  });
});
