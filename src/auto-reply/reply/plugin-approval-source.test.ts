import { describe, expect, it } from "vitest";
import { capturePluginApprovalSource } from "./plugin-approval-source.js";

const authorizedSlackMessage = {
  context: {
    InboundAccessAuthorized: true,
    SenderId: "U123",
    SenderName: "Lightning McQueen",
    GroupSpace: "T123",
    RawBody: "Please render alpha to beta",
  },
  channel: "slack",
  conversationKind: "direct" as const,
  isHeartbeat: false,
  isRoomEvent: false,
  reusesTurnRecorder: false,
};

describe("plugin approval source snapshot", () => {
  it("captures the admitted Slack sender and redacts before truncating the original text", () => {
    expect(capturePluginApprovalSource(authorizedSlackMessage)).toEqual({
      channel: "slack",
      senderId: "U123",
      senderName: "Lightning McQueen",
      workspaceId: "T123",
      conversationKind: "direct",
      userMessageExcerpt: "Please render alpha to beta",
    });

    const secret = `ghp_${"a".repeat(100)}`;
    const source = capturePluginApprovalSource({
      ...authorizedSlackMessage,
      context: {
        ...authorizedSlackMessage.context,
        RawBody: `${"x".repeat(290)} ${secret} after`,
      },
    });
    expect(source?.userMessageExcerpt?.length).toBeLessThanOrEqual(320);
    expect(source?.userMessageExcerpt).not.toContain(secret);
    expect(source?.senderName).toBe("Lightning McQueen");
  });

  it.each([
    {
      reason: "unadmitted",
      patch: { context: { ...authorizedSlackMessage.context, InboundAccessAuthorized: false } },
    },
    {
      reason: "self",
      patch: { context: { ...authorizedSlackMessage.context, SenderIsSelf: true } },
    },
    { reason: "internal", patch: { provenance: { kind: "internal_system" as const } } },
    { reason: "reused turn", patch: { reusesTurnRecorder: true } },
    { reason: "room event", patch: { isRoomEvent: true } },
  ])("omits $reason input", ({ patch }) => {
    expect(capturePluginApprovalSource({ ...authorizedSlackMessage, ...patch })).toBeUndefined();
  });
});
