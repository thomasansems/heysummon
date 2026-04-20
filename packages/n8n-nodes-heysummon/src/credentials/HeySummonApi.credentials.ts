import type {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class HeySummonApi implements ICredentialType {
  name = "heySummonApi";
  displayName = "HeySummon API";
  documentationUrl = "https://docs.heysummon.ai/integrations/orchestrators/n8n";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "HeySummon client API key (`hs_cli_*`).",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "http://localhost:3445",
      required: true,
      placeholder: "https://heysummon.example.com",
      description:
        "URL of your self-hosted HeySummon instance. Must include the scheme (http/https).",
    },
    {
      displayName: "End-to-End Encryption",
      name: "e2eEnabled",
      type: "boolean",
      default: true,
      description:
        "When on (default), the node generates ephemeral X25519 keys per Summon and decrypts the response in process. When off, Get Status can return the plaintext response across executions.",
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/health",
      method: "GET",
    },
  };
}
