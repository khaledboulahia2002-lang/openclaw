import { afterEach, expect, it, vi } from "vitest";
import { resetAgentRunRegistryForTest } from "../../infra/agent-run-registry.js";
import { runBeforeToolCallHook } from "../agent-tools.before-tool-call.js";
import { createAdmittedHostCapabilityTestFixture } from "./host-capability.test-support.js";

vi.mock("../agent-tools.before-tool-call.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agent-tools.before-tool-call.js")>()),
  runBeforeToolCallHook: vi.fn(async ({ params }) => ({ blocked: false, params })),
}));

afterEach(() => {
  resetAgentRunRegistryForTest();
  vi.clearAllMocks();
});

it.each([
  { sourceThreadId: undefined, expectedThreadId: undefined },
  { sourceThreadId: "1700000000.000001", expectedThreadId: "1700000000.000001" },
])(
  "routes approval context using the real source thread $sourceThreadId",
  async ({ sourceThreadId, expectedThreadId }) => {
    const fixture = await createAdmittedHostCapabilityTestFixture({
      runId: `approval-thread-${sourceThreadId ?? "root"}`,
      messageChannel: "slack",
      currentThreadTs: "1700000001.000002",
      messageThreadId: sourceThreadId,
    });
    try {
      vi.mocked(runBeforeToolCallHook).mockImplementationOnce(async ({ ctx, params }) => {
        expect(ctx?.turnSourceThreadId).toBe(expectedThreadId);
        return { blocked: false, params };
      });
      await fixture.hostCapabilities.runBeforeToolCall({ toolName: "read", params: {} });
    } finally {
      fixture.closeHost();
      fixture.closeAdmission();
    }
  },
);
