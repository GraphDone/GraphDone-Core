import { describe, it, expect } from 'vitest';
import { testTools } from './test-tools';

describe('MCP Protocol Compliance', () => {
  const mockTools = testTools;

  describe('Tool Schema Validation', () => {
    it('should have valid tool names', () => {
      mockTools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(tool.name).toMatch(/^[a-z_]+$/); // Only lowercase and underscores
      });
    });

    it('should have descriptions for all tools', () => {
      mockTools.forEach(tool => {
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });

    it('should have valid input schemas', () => {
      mockTools.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        
        // Validate each property in the schema
        Object.entries(tool.inputSchema.properties).forEach(([propName, propSchema]: [string, any]) => {
          expect(propName).toBeDefined();
          expect(propSchema.type).toBeDefined();
          
          // If it has an enum, validate enum values
          if (propSchema.enum) {
            expect(Array.isArray(propSchema.enum)).toBe(true);
            expect(propSchema.enum.length).toBeGreaterThan(0);
          }
          
          // If it has a default, validate it matches the type
          if (propSchema.default !== undefined) {
            if (propSchema.type === 'string') {
              expect(typeof propSchema.default).toBe('string');
            } else if (propSchema.type === 'number') {
              expect(typeof propSchema.default).toBe('number');
            } else if (propSchema.type === 'boolean') {
              expect(typeof propSchema.default).toBe('boolean');
            }
          }
        });
      });
    });

    it('should have consistent naming conventions', () => {
      mockTools.forEach(tool => {
        // Tool names should use snake_case
        expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
        
        // Property names should use snake_case
        Object.keys(tool.inputSchema.properties).forEach(propName => {
          expect(propName).toMatch(/^[a-z]+(_[a-z]+)*$/);
        });
      });
    });

    it('should have required fields specified correctly', () => {
      mockTools.forEach(tool => {
        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
          
          // All required fields should exist in properties
          tool.inputSchema.required.forEach((requiredField: string) => {
            expect(tool.inputSchema.properties[requiredField]).toBeDefined();
          });
        }
      });
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle schema validation for enums', () => {
      const toolWithEnum = mockTools.find(t => t.name === 'browse_graph');
      if (toolWithEnum) {
        const queryTypeProperty = toolWithEnum.inputSchema.properties.query_type;
        expect(queryTypeProperty.enum).toContain('all_nodes');
        expect(queryTypeProperty.enum).toContain('by_type');
        expect(queryTypeProperty.enum).not.toContain('invalid_option');
      }
    });

    it('should validate priority type enums', () => {
      const contributorTool = mockTools.find(t => t.name === 'get_contributor_priorities');
      if (contributorTool) {
        const priorityTypeProperty = contributorTool.inputSchema.properties.priority_type;
        expect(priorityTypeProperty.enum).toEqual(['all', 'executive', 'individual', 'community', 'composite']);
      }
    });

    it('should have appropriate defaults', () => {
      mockTools.forEach(tool => {
        Object.entries(tool.inputSchema.properties).forEach(([propName, propSchema]: [string, any]) => {
          if (propSchema.default !== undefined) {
            // Defaults should be valid enum values if enum exists
            if (propSchema.enum) {
              expect(propSchema.enum).toContain(propSchema.default);
            }
            
            // Defaults should match the expected type
            expect(typeof propSchema.default).toBe(propSchema.type);
          }
        });
      });
    });
  });

  describe('MCP Response Format Validation', () => {
    it('should validate response structure', () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Sample response'
          }
        ]
      };

      expect(mockResponse.content).toBeDefined();
      expect(Array.isArray(mockResponse.content)).toBe(true);
      expect(mockResponse.content.length).toBeGreaterThan(0);
      
      mockResponse.content.forEach(item => {
        expect(item.type).toBe('text');
        expect(typeof item.text).toBe('string');
      });
    });

    it('should validate error response structure', () => {
      const mockErrorResponse = {
        content: [
          {
            type: 'text',
            text: 'Error: Something went wrong'
          }
        ],
        isError: true
      };

      expect(mockErrorResponse.content).toBeDefined();
      expect(mockErrorResponse.isError).toBe(true);
      expect(mockErrorResponse.content[0].text).toContain('Error:');
    });

    it('should validate JSON response content', () => {
      const mockJSONResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              result: 'success',
              data: { id: 'test', value: 123 }
            }, null, 2)
          }
        ]
      };

      expect(() => JSON.parse(mockJSONResponse.content[0].text)).not.toThrow();
      const parsed = JSON.parse(mockJSONResponse.content[0].text);
      expect(parsed.result).toBe('success');
      expect(parsed.data).toBeDefined();
    });
  });

  describe('Tool Capability Completeness', () => {
    it('should cover all major operation categories', () => {
      const toolNames = mockTools.map(tool => tool.name);
      
      // Should have basic CRUD operations
      const basicOperations = ['browse_graph', 'create_node', 'update_node', 'delete_node'];
      basicOperations.forEach(op => {
        expect(toolNames).toContain(op);
      });
    });

    it('should have contributor-focused operations', () => {
      const toolNames = mockTools.map(tool => tool.name);
      
      const contributorOps = [
        'get_contributor_priorities',
        'get_contributor_workload',
        'find_contributors_by_project',
        'get_project_team',
        'get_contributor_expertise',
        'get_collaboration_network',
        'get_contributor_availability'
      ];
      
      // At least some contributor operations should be present
      const hasContributorOps = contributorOps.some(op => toolNames.includes(op));
      expect(hasContributorOps).toBe(true);
    });
  });

  describe('Parameter Validation Logic', () => {
    it('should validate required parameters', () => {
      const validateParameters = (tool: any, params: any) => {
        if (tool.inputSchema.required) {
          for (const requiredField of tool.inputSchema.required) {
            if (params[requiredField] === undefined || params[requiredField] === null) {
              return { valid: false, error: `Missing required parameter: ${requiredField}` };
            }
          }
        }
        return { valid: true };
      };

      const contributorTool = mockTools.find(t => t.name === 'get_contributor_priorities');
      if (contributorTool) {
        // Valid case
        const validParams = { contributor_id: 'test-123' };
        expect(validateParameters(contributorTool, validParams).valid).toBe(true);
        
        // Invalid case - missing required parameter
        const invalidParams = { limit: 10 };
        expect(validateParameters(contributorTool, invalidParams).valid).toBe(false);
      }
    });

    it('should validate enum parameters', () => {
      const validateEnum = (enumValues: string[], value: string) => {
        return enumValues.includes(value);
      };

      const toolWithEnum = mockTools.find(t => t.name === 'browse_graph');
      if (toolWithEnum) {
        const enumValues = toolWithEnum.inputSchema.properties.query_type.enum;
        
        expect(validateEnum(enumValues, 'all_nodes')).toBe(true);
        expect(validateEnum(enumValues, 'by_type')).toBe(true);
        expect(validateEnum(enumValues, 'invalid_value')).toBe(false);
      }
    });

    it('should validate type constraints', () => {
      const validateType = (expectedType: string, value: any) => {
        switch (expectedType) {
          case 'string':
            return typeof value === 'string';
          case 'number':
            return typeof value === 'number' && !isNaN(value);
          case 'boolean':
            return typeof value === 'boolean';
          case 'array':
            return Array.isArray(value);
          case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
          default:
            return false;
        }
      };

      expect(validateType('string', 'test')).toBe(true);
      expect(validateType('string', 123)).toBe(false);
      expect(validateType('number', 42)).toBe(true);
      expect(validateType('number', 'not-a-number')).toBe(false);
      expect(validateType('boolean', true)).toBe(true);
      expect(validateType('boolean', 'true')).toBe(false);
    });
  });
});