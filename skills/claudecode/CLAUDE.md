# HeySummon

When you are truly stuck and need human input, use the `heysummon` MCP tool to request help from a human expert.

## When to use

Use HeySummon when you are **genuinely blocked** — not as a first resort:

- Requirements are ambiguous and you need clarification from a human
- You need domain expertise you cannot find autonomously
- A decision requires human judgment (architecture, business logic, security)
- You've tried multiple approaches and remain stuck

## How to use

Call the `heysummon` tool with:

- `question` — your specific question (be concise and precise)
- `context` — relevant code snippet, error, or background (optional but recommended)
- `provider` — provider name if routing to a specific expert (optional)

## Example

```
I need help with the database schema design for multi-tenant isolation.
Context: [paste relevant schema/code]
```

## What happens

1. Your question is sent to a human expert via the HeySummon platform
2. The expert is notified and responds
3. The response is returned directly to you here

## Important

- Wait for the response before proceeding — do not guess or make assumptions
- Be specific: vague questions get vague answers
- Include error messages, relevant code, and what you've already tried
