import {it,expect} from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import {readFileSync} from 'node:fs';
import {projectDocument,parseProjectDocument} from './format';
it('published schema validates the documented example and a real exported round trip',()=>{
 const schema=JSON.parse(readFileSync('public/schemas/project-v1.schema.json','utf8'));
 const example=JSON.parse(readFileSync('../../docs/formats/project-v1.example.json','utf8'));
 const ajv=new Ajv2020({allErrors:true});addFormats(ajv);const validate=ajv.compile(schema);
 expect(validate(example),JSON.stringify(validate.errors)).toBe(true);
 const doc=projectDocument(parseProjectDocument(example));expect(validate(doc),JSON.stringify(validate.errors)).toBe(true);
 expect(validate({...doc,version:2})).toBe(false);
});
