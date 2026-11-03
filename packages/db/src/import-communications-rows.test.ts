import { describe, expect, it } from "vitest";

import { mapCommunicationsRow, validateCommunicationsRows } from "./import-communications-rows.js";

describe("import-communications-rows", () => {
  const columnMapping = {
    "Message ID": "sourceId",
    Channel: "channel",
    Direction: "direction",
    To: "toAddress",
    Body: "body",
    "Sent At": "sentAt",
  };

  it("maps a Jobber-style communications export row", () => {
    const mapped = mapCommunicationsRow(
      {
        "Message ID": "msg-100",
        Channel: "SMS",
        Direction: "Outbound",
        To: "+15551230000",
        Body: "Your tech is on the way.",
        "Sent At": "2024-06-01T14:00:00Z",
      },
      columnMapping,
    );

    expect(mapped).toMatchObject({
      sourceId: "msg-100",
      channel: "sms",
      direction: "outbound",
      toAddress: "+15551230000",
      body: "Your tech is on the way.",
    });
  });

  it("flags duplicate vendor message ids during validation", () => {
    const result = validateCommunicationsRows(
      [
        {
          rowNumber: 2,
          values: {
            "Message ID": "dup-1",
            Channel: "email",
            Direction: "inbound",
            To: "a@example.com",
            Body: "Hello",
          },
        },
        {
          rowNumber: 3,
          values: {
            "Message ID": "dup-1",
            Channel: "email",
            Direction: "inbound",
            To: "b@example.com",
            Body: "Hello again",
          },
        },
      ],
      columnMapping,
    );

    expect(result.errorRows).toBe(1);
    expect(result.validationErrors[0]?.field).toBe("sourceId");
  });
});
