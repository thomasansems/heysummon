import {
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from "n8n-workflow";

import { runSummon } from "./operations/summon";
import { runGetStatus } from "./operations/getStatus";
import type { CredentialFields } from "./lib/client-factory";

export class HeySummon implements INodeType {
  description: INodeTypeDescription = {
    displayName: "HeySummon",
    name: "heySummon",
    icon: "file:heysummon.svg",
    group: ["transform"],
    version: 1,
    subtitle: "={{$parameter[\"operation\"]}}",
    description: "Human-in-the-loop for AI agents",
    defaults: { name: "HeySummon" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "heySummonApi", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "summon",
        options: [
          {
            name: "Summon",
            value: "summon",
            description:
              "Send a question to a human expert and wait for the answer.",
            action: "Summon a human expert",
          },
          {
            name: "Get Status",
            value: "getStatus",
            description:
              "Look up an existing request by ID. Returns metadata only when E2E is on.",
            action: "Get the status of an existing help request",
          },
        ],
      },

      // Summon parameters
      {
        displayName: "Question",
        name: "question",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { operation: ["summon"] } },
        description: "Plaintext question for the expert.",
      },
      {
        displayName: "Context",
        name: "context",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        displayOptions: { show: { operation: ["summon"] } },
        description: "Optional background sent as the first message.",
      },
      {
        displayName: "Expert Name",
        name: "expertName",
        type: "string",
        default: "",
        displayOptions: { show: { operation: ["summon"] } },
        description: "Route to a specific expert by name. Leave blank for default routing.",
      },
      {
        displayName: "Requires Approval",
        name: "requiresApproval",
        type: "boolean",
        default: false,
        displayOptions: { show: { operation: ["summon"] } },
        description: "Surface the request as an Approve/Deny prompt in the dashboard.",
      },
      {
        displayName: "Timeout (Ms)",
        name: "timeoutMs",
        type: "number",
        default: 900000,
        typeOptions: { minValue: 1000 },
        displayOptions: { show: { operation: ["summon"] } },
        description: "Client-side timeout in milliseconds (default 15 minutes).",
      },
      {
        displayName: "Poll Interval (Ms)",
        name: "pollIntervalMs",
        type: "number",
        default: 2000,
        typeOptions: { minValue: 250 },
        displayOptions: { show: { operation: ["summon"] } },
        description: "How often to poll the status endpoint while waiting.",
      },

      // Get Status parameters
      {
        displayName: "Request ID",
        name: "requestId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["getStatus"] } },
        description: "The requestId returned by a previous Summon call.",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const successItems: INodeExecutionData[] = [];
    const failureItems: INodeExecutionData[] = [];

    const credentialsRaw = (await this.getCredentials("heySummonApi")) as Record<
      string,
      unknown
    >;
    const credentials: CredentialFields = {
      apiKey: String(credentialsRaw.apiKey ?? ""),
      baseUrl: String(credentialsRaw.baseUrl ?? ""),
      e2eEnabled: credentialsRaw.e2eEnabled !== false,
    };

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter("operation", i) as string;
      let result: unknown;

      if (operation === "summon") {
        result = await runSummon(
          {
            question: this.getNodeParameter("question", i, "") as string,
            context: this.getNodeParameter("context", i, "") as string,
            expertName: this.getNodeParameter("expertName", i, "") as string,
            requiresApproval: this.getNodeParameter(
              "requiresApproval",
              i,
              false
            ) as boolean,
            timeoutMs: this.getNodeParameter("timeoutMs", i, 900_000) as number,
            pollIntervalMs: this.getNodeParameter(
              "pollIntervalMs",
              i,
              2_000
            ) as number,
          },
          credentials
        );
      } else if (operation === "getStatus") {
        result = await runGetStatus(
          {
            requestId: this.getNodeParameter("requestId", i, "") as string,
          },
          credentials
        );
      } else {
        throw new NodeOperationError(
          this.getNode(),
          `Unknown operation: ${operation}`,
          { itemIndex: i }
        );
      }

      const isErrorEnvelope =
        typeof result === "object" &&
        result !== null &&
        "error" in (result as Record<string, unknown>);

      if (isErrorEnvelope) {
        if (this.continueOnFail()) {
          failureItems.push({ json: result as IDataObject, pairedItem: i });
        } else {
          const env = (result as { error: { message: string } }).error;
          throw new NodeOperationError(this.getNode(), env.message, {
            itemIndex: i,
          });
        }
      } else {
        successItems.push({
          json: result as IDataObject,
          pairedItem: i,
        });
      }
    }

    if (failureItems.length > 0) {
      return [successItems, failureItems];
    }
    return [successItems];
  }
}
