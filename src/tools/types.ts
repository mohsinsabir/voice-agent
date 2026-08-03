export type ToolName =
  | "checkAvailability"
  | "bookAppointment"
  | "rescheduleAppointment"
  | "cancelAppointment"
  | "createOrUpdateContact"
  | "saveLeadQualification"
  | "requestHumanHandoff"
  | "sendConfirmation"
  | "logCallOutcome";

export type ToolRequest = {
  call: { call_id: string; agent_id?: string };
  name: ToolName | string;
  args: Record<string, unknown>;
};

export type ToolResult = {
  result: Record<string, unknown>;
};

export function okResult(data: Record<string, unknown>): ToolResult {
  return { result: { success: true, ...data } };
}

export function failResult(
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): ToolResult {
  return {
    result: {
      success: false,
      error: { code, message },
      ...extra,
    },
  };
}
