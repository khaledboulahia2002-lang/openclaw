import { truncateUtf16Safe } from "@openclaw/normalization-core/utf16-slice";
import {
  sanitizeExecApprovalDisplayTextWithStatus,
  sanitizeExecApprovalWarningTextWithStatus,
} from "../../infra/exec-approval-text-sanitize.js";
import type { PluginApprovalSource } from "../../infra/plugin-approvals.js";
import type { InputProvenance } from "../../sessions/input-provenance.js";
import type { TemplateContext } from "../templating.js";

const MAX_APPROVAL_MESSAGE_EXCERPT_LENGTH = 320;
const MAX_APPROVAL_SENDER_NAME_LENGTH = 80;

/** Snapshot only an admitted external Slack message before queued turns can rewrite it. */
export function capturePluginApprovalSource(params: {
  context: Pick<
    TemplateContext,
    | "InboundAccessAuthorized"
    | "SenderIsSelf"
    | "SenderId"
    | "SenderName"
    | "GroupSpace"
    | "RawBody"
  >;
  channel?: string;
  conversationKind?: "direct" | "group" | "channel";
  provenance?: InputProvenance;
  isHeartbeat: boolean;
  isRoomEvent: boolean;
  reusesTurnRecorder: boolean;
}): PluginApprovalSource | undefined {
  const { context } = params;
  if (
    params.channel !== "slack" ||
    context.InboundAccessAuthorized !== true ||
    context.SenderIsSelf === true ||
    params.isHeartbeat ||
    params.isRoomEvent ||
    params.reusesTurnRecorder ||
    (params.provenance && params.provenance.kind !== "external_user") ||
    !context.SenderId?.trim()
  ) {
    return undefined;
  }
  const rawBody = context.RawBody;
  const sanitized = rawBody ? sanitizeExecApprovalWarningTextWithStatus(rawBody) : undefined;
  const displayText = sanitized && !sanitized.oversized ? sanitized.text.trim() : "";
  const userMessageExcerpt =
    displayText.length > MAX_APPROVAL_MESSAGE_EXCERPT_LENGTH
      ? `${truncateUtf16Safe(displayText, MAX_APPROVAL_MESSAGE_EXCERPT_LENGTH - 1)}…`
      : displayText;
  const sanitizedName = context.SenderName
    ? sanitizeExecApprovalDisplayTextWithStatus(context.SenderName)
    : undefined;
  const displayName = sanitizedName && !sanitizedName.oversized ? sanitizedName.text.trim() : "";
  const senderName =
    displayName.length > MAX_APPROVAL_SENDER_NAME_LENGTH
      ? `${truncateUtf16Safe(displayName, MAX_APPROVAL_SENDER_NAME_LENGTH - 1)}…`
      : displayName;
  return {
    channel: "slack",
    senderId: context.SenderId.trim(),
    ...(senderName && senderName !== context.SenderId.trim() ? { senderName } : {}),
    ...(context.GroupSpace?.trim() ? { workspaceId: context.GroupSpace.trim() } : {}),
    ...(params.conversationKind ? { conversationKind: params.conversationKind } : {}),
    ...(userMessageExcerpt ? { userMessageExcerpt } : {}),
  };
}
