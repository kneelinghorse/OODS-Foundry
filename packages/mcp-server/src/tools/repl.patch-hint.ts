const PATCH_EXAMPLE = [
  'Valid patch examples:',
  'JSON Patch array:',
  '  [{"op":"replace","path":"/screens/0/children/0/props/label","value":"Save"}]',
  'Node patch object:',
  '  {"nodeId":"basic-button","path":"props.label","value":"Save"}',
].join('\n');

export function patchExampleHint(): string {
  return PATCH_EXAMPLE;
}
