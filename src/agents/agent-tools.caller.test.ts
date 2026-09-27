import { describe, expect, it } from "vitest";
import { createCodingToolsGatewayCaller } from "./agent-tools.caller.js";
import { resolveConversationCapabilityProfile } from "./conversation-capability-profile.js";
import type { AnyAgentTool } from "./tools/common.js";
import { getGatewayToolCallerIdentity } from "./tools/gateway-caller-context.js";

describe("coding tool delegation policy", () => {
  it("does not promote a Slack message anchor into an approval source thread", async () => {
    const agentId = "main";
    const sessionKey = "agent:main:slack:direct:u123";
    const wrap = createCodingToolsGatewayCaller({
      options: {
        messageChannel: "slack",
        currentMessagingTarget: "user:U123",
        currentThreadTs: "1700000001.000002",
      },
      agentId,
      sessionKey,
      capabilityProfile: resolveConversationCapabilityProfile({ agentId, sessionKey }),
    });
    const tool: AnyAgentTool = {
      name: "probe",
      label: "Probe",
      description: "Inspect caller",
      parameters: { type: "object", properties: {} },
      async execute() {
        expect(getGatewayToolCallerIdentity()?.turnSourceThreadId).toBeUndefined();
        return { content: [], details: {} };
      },
    };

    await wrap(tool).execute("probe-call", {});
  });

  it("carries the resolved runtime cap into a plugin's remote execution request", async () => {
    const agentId = "main";
    const sessionKey = "agent:main:preview";
    const capabilityProfile = resolveConversationCapabilityProfile({
      agentId,
      sessionKey,
      config: { tools: { profile: "full" } },
      runtimeToolAllowlist: ["crabbox", "read"],
      inheritRuntimeToolAllowlist: true,
    });
    const plugin: AnyAgentTool = {
      name: "crabbox",
      label: "Crabbox",
      description: "Delegate an environment command",
      parameters: { type: "object", properties: {} },
      async execute() {
        const caller = getGatewayToolCallerIdentity();
        expect(caller?.agentId).toBe(agentId);
        expect(caller?.sessionKey).toBe(sessionKey);
        expect(caller?.assertToolAllowed).toBeDefined();
        caller?.assertToolAllowed?.("read");
        caller?.assertToolAllowed?.("exec");
        return { content: [], details: {} };
      },
    };
    const wrap = createCodingToolsGatewayCaller({
      options: {},
      agentId,
      sessionKey,
      capabilityProfile,
    });
    await expect(wrap(plugin).execute("run", {})).rejects.toThrow("exec is not allowed");
  });
});
