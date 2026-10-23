import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/v4';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ReadBuffer } from '@modelcontextprotocol/sdk/shared/stdio.js';
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  CompleteResultSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolRequest,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

describe('Zod constrained collection parsing', () => {
  it('rejects an oversized array before element and later container refinements', () => {
    const element = vi.fn(() => true);
    const collection = vi.fn(() => true);
    const schema = z.array(z.string().refine(element)).max(2).refine(collection);

    expect(schema.safeParse(['a', 'b', 'c']).success).toBe(false);
    expect(element).not.toHaveBeenCalled();
    expect(collection).not.toHaveBeenCalled();

    expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(element).toHaveBeenCalledTimes(2);
    expect(collection).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized set before element and later container refinements', () => {
    const element = vi.fn(() => true);
    const collection = vi.fn(() => true);
    const schema = z.set(z.string().refine(element)).max(2).refine(collection);

    expect(schema.safeParse(new Set(['a', 'b', 'c'])).success).toBe(false);
    expect(element).not.toHaveBeenCalled();
    expect(collection).not.toHaveBeenCalled();

    expect(schema.parse(new Set(['a', 'b']))).toEqual(new Set(['a', 'b']));
    expect(element).toHaveBeenCalledTimes(2);
    expect(collection).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized map before parsing keys or values', () => {
    const key = vi.fn(() => true);
    const value = vi.fn(() => true);
    const schema = z.map(z.string().refine(key), z.string().refine(value)).check(z.maxSize(2));

    expect(schema.safeParse(new Map([['a', 'A'], ['b', 'B'], ['c', 'C']])).success).toBe(false);
    expect(key).not.toHaveBeenCalled();
    expect(value).not.toHaveBeenCalled();

    const valid = new Map([['a', 'A'], ['b', 'B']]);
    expect(schema.parse(valid)).toEqual(valid);
    expect(key).toHaveBeenCalledTimes(2);
    expect(value).toHaveBeenCalledTimes(2);
  });

  it('returns one size issue instead of collecting each oversized array element error', () => {
    const result = z.array(z.string()).length(2).safeParse(Array(8).fill(0));

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected the array length to be rejected');
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: 'too_big', maximum: 2, path: [] });
  });

  it('still validates invalid elements inside the allowed size', () => {
    const result = z.array(z.string()).max(2).safeParse([0]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected the invalid element to be rejected');
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: 'invalid_type', path: [0] });
  });

  it('enforces the SDK completion result bound before validating 101 elements', () => {
    const result = CompleteResultSchema.safeParse({ completion: { values: Array(101).fill(0) } });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected the completion size to be rejected');
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({
      code: 'too_big', maximum: 100, path: ['completion', 'values'],
    });
    expect(CompleteResultSchema.parse({ completion: { values: ['valid'], hasMore: false } }))
      .toEqual({ completion: { values: ['valid'], hasMore: false } });
  });
});

describe('MCP SDK boundaries used by GraphDone', () => {
  let server: Server;
  let client: Client;
  let response: unknown;
  const onCall = vi.fn(async (_request: CallToolRequest): Promise<CallToolResult> => response as CallToolResult);
  const tool: Tool = {
    name: 'fixture_echo',
    description: 'Return a controlled result for the SDK compatibility fixture',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        priority: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
        metadata: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },
  };

  beforeEach(async () => {
    onCall.mockClear();
    response = { content: [{ type: 'text', text: 'accepted' }] };
    server = new Server({ name: 'graphdone-sdk-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
    client = new Client({ name: 'graphdone-sdk-fixture-client', version: '1.0.0' });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [tool] }));
    server.setRequestHandler(CallToolRequestSchema, onCall);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client?.close();
    await server?.close();
  });

  it('initializes, lists the JSON schema unchanged and preserves nested arguments and metadata', async () => {
    expect(client.getServerVersion()).toEqual({ name: 'graphdone-sdk-fixture', version: '1.0.0' });
    expect(await client.listTools()).toEqual({ tools: [tool] });
    const args = { title: 'Owned fixture', metadata: { tags: ['a'], cleared: null, enabled: false } };
    const metadata = { progressToken: 'fixture-progress', 'fixture/context': { graph: 'owned' } };

    expect(await client.callTool({ name: tool.name, arguments: args, _meta: metadata })).toEqual(response);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall.mock.calls[0][0].params).toEqual({ name: tool.name, arguments: args, _meta: metadata });
    expect(onCall.mock.calls[0][0].params.arguments).not.toHaveProperty('priority');
  });

  it('keeps omitted arguments absent and normalizes an omitted result content list', async () => {
    response = {};

    expect(await client.callTool({ name: tool.name })).toEqual({ content: [] });
    expect(onCall.mock.calls[0][0].params).toEqual({ name: tool.name });
  });

  it.each([
    { name: 42, arguments: {} },
    { name: 'fixture_echo', arguments: [] },
    { name: 'fixture_echo', arguments: null },
  ])('rejects malformed tool-call params before dispatch: %j', async params => {
    await expect(client.request({ method: 'tools/call', params }, CallToolResultSchema))
      .rejects.toBeInstanceOf(McpError);
    expect(onCall).not.toHaveBeenCalled();
  });

  it('reports an invalid result as a protocol error and accepts the next valid result', async () => {
    response = { content: [{ type: 'text', text: 42 }] };

    await expect(client.callTool({ name: tool.name })).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    response = { isError: true, content: [{ type: 'text', text: 'Fixture operation failed' }] };
    expect(await client.callTool({ name: tool.name })).toEqual(response);
    expect(onCall).toHaveBeenCalledTimes(2);
  });

  it('rejects a malformed stdio envelope and then parses the next bounded message', () => {
    const buffer = new ReadBuffer({ maxBufferSize: 256 });
    buffer.append(Buffer.from('{"jsonrpc":"2.0","id":true,"method":"tools/list"}\n'));
    expect(() => buffer.readMessage()).toThrow();
    buffer.append(Buffer.from('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\r\n'));
    expect(buffer.readMessage()).toEqual({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(buffer.readMessage()).toBeNull();
    expect(() => buffer.append(Buffer.alloc(257))).toThrow('maximum size of 256 bytes');
    expect(buffer.readMessage()).toBeNull();
  });
});
