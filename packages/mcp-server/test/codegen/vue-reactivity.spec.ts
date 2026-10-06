/**
 * Tests for Vue 3 Composition API reactivity patterns in codegen (s80-m04).
 *
 * Validates:
 * 1. Form components emit ref() bindings for each input field
 * 2. Computed properties for derived display values
 * 3. v-model directives on input/select/textarea elements
 * 4. Event handler stubs include Vue-typed parameters
 * 5. Cross-framework parity tests still pass
 */
import { describe, it, expect } from 'vitest';
import { emit } from '../../src/codegen/vue-emitter.js';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../../src/schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeFormSchema(
  fields: Record<string, FieldSchemaEntry>,
  elements: UiElement[],
): UiSchema {
  return {
    version: '1.0',
    screens: [{
      id: 'form-root',
      component: 'Stack',
      layout: { type: 'stack' },
      children: elements,
    }],
    objectSchema: fields,
  };
}

function makeDisplaySchema(
  fields: Record<string, FieldSchemaEntry>,
  elements: UiElement[],
): UiSchema {
  return {
    version: '1.0',
    screens: [{
      id: 'detail-root',
      component: 'Stack',
      layout: { type: 'stack' },
      children: elements,
    }],
    objectSchema: fields,
  };
}

/* ------------------------------------------------------------------ */
/*  ref() bindings for form fields                                     */
/* ------------------------------------------------------------------ */

describe('vue-emitter — ref() bindings', () => {
  it('seeds each local form ref from optional typed props while preserving omitted-value defaults', () => {
    const schema = makeFormSchema(
      {
        name: { type: 'string', required: true, description: 'User name' },
        age: { type: 'integer', required: false },
        active: { type: 'boolean', required: true },
      },
      [
        { id: 'inp-name', component: 'Input', props: { field: 'name' } },
        { id: 'inp-age', component: 'Input', props: { field: 'age' } },
        { id: 'tog-active', component: 'Toggle', props: { field: 'active' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain("import { ref } from 'vue';");
    expect(result.code).toContain("const name = ref<string>(generatedProps.name ?? '')");
    expect(result.code).toContain("name?: string;");
    expect(result.code).toContain("const generatedProps = defineProps<Props>();");
    expect(result.code).toContain("const age = ref<number>(generatedProps.age ?? 0)");
    expect(result.code).toContain("const active = ref<boolean>(generatedProps.active ?? false)");
  });

  it('uses correct default values for different field types', () => {
    const schema = makeFormSchema(
      {
        tags: { type: 'array', required: false },
        config: { type: 'object', required: false },
        status: { type: 'string', required: true, enum: ['active', 'inactive'] },
      },
      [
        { id: 'inp-tags', component: 'TagInput', props: { field: 'tags' } },
        { id: 'inp-status', component: 'Select', props: { field: 'status' } },
        // s213-m01 (finding 6): a declared field no node reads gets no ref, so the object default needs a reader.
        { id: 'txt-config', component: 'Text', props: { field: 'config' } },
      ],
    );
    const result = emit(schema, { typescript: false, styling: 'inline' });
    expect(result.code).toContain("const tags = ref(generatedProps.tags ?? [])");
    expect(result.code).toContain("const config = ref(generatedProps.config ?? {})");
    expect(result.code).toContain("const status = ref(generatedProps.status ?? 'active')");
  });

  it('declares no ref for a field no node reads (s213-m01, finding 6)', () => {
    const schema = makeFormSchema(
      {
        tags: { type: 'array', required: false },
        config: { type: 'object', required: false },
      },
      [{ id: 'inp-tags', component: 'TagInput', props: { field: 'tags' } }],
    );
    const result = emit(schema, { typescript: false, styling: 'inline' });
    expect(result.code).toContain("const tags = ref(generatedProps.tags ?? [])");
    // An unread ref fails a consumer compile under noUnusedLocals.
    expect(result.code).not.toMatch(/const config = ref\(/);
  });

  it('does NOT generate ref() for non-form display schemas', () => {
    const schema = makeDisplaySchema(
      {
        name: { type: 'string', required: true },
      },
      [
        { id: 'text-name', component: 'Text', props: { field: 'name' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).not.toContain("import { ref }");
    expect(result.code).not.toContain("ref(");
    expect(result.code).toContain("defineProps");
  });

  it('includes field descriptions as JSDoc comments', () => {
    const schema = makeFormSchema(
      {
        email: { type: 'email', required: true, description: 'Contact email' },
      },
      [
        { id: 'inp-email', component: 'Input', props: { field: 'email' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain('/** Contact email */');
  });
});

/* ------------------------------------------------------------------ */
/*  computed() for derived values                                      */
/* ------------------------------------------------------------------ */

describe('vue-emitter — computed() properties', () => {
  it('generates fullName computed from firstName + lastName', () => {
    const schema = makeFormSchema(
      {
        firstName: { type: 'string', required: true },
        lastName: { type: 'string', required: true },
      },
      [
        { id: 'inp-fn', component: 'Input', props: { field: 'firstName' } },
        { id: 'inp-ln', component: 'Input', props: { field: 'lastName' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain("import { computed, ref } from 'vue';");
    expect(result.code).toContain("const fullName = computed(");
    expect(result.code).toContain("firstName.value");
    expect(result.code).toContain("lastName.value");
  });

  it('does NOT generate computed when no derivable fields exist', () => {
    const schema = makeFormSchema(
      {
        email: { type: 'email', required: true },
        phone: { type: 'string', required: false },
      },
      [
        { id: 'inp-email', component: 'Input', props: { field: 'email' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).not.toContain("computed(");
  });
});

/* ------------------------------------------------------------------ */
/*  v-model directives                                                 */
/* ------------------------------------------------------------------ */

describe('vue-emitter — v-model', () => {
  it('emits v-model on Input elements with field binding', () => {
    const schema = makeFormSchema(
      {
        name: { type: 'string', required: true },
      },
      [
        { id: 'inp-name', component: 'Input', props: { field: 'name' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain('v-model="name"');
  });

  it('emits v-model on Select elements with field binding', () => {
    const schema = makeFormSchema(
      {
        role: { type: 'string', required: true, enum: ['admin', 'user'] },
      },
      [
        { id: 'sel-role', component: 'Select', props: { field: 'role' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain('v-model="role"');
  });

  it('emits v-model on Textarea elements with field binding', () => {
    const schema = makeFormSchema(
      {
        description: { type: 'string', required: false },
      },
      [
        { id: 'ta-desc', component: 'Textarea', props: { field: 'description' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain('v-model="description"');
  });

  it('does NOT emit v-model on non-form components', () => {
    const schema = makeFormSchema(
      {
        title: { type: 'string', required: true },
      },
      [
        { id: 'text-title', component: 'Text', props: { field: 'title' } },
        { id: 'inp-title', component: 'Input', props: { field: 'title' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    // Text should not have v-model
    const textMatch = result.code.match(/<Text[^>]*>/);
    expect(textMatch?.[0]).not.toContain('v-model');
  });

  it('converts snake_case field to camelCase in v-model', () => {
    const schema = makeFormSchema(
      {
        first_name: { type: 'string', required: true },
      },
      [
        { id: 'inp-fn', component: 'Input', props: { field: 'first_name' } },
      ],
    );
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain('v-model="firstName"');
  });
});

/* ------------------------------------------------------------------ */
/*  Typed action protocol                                              */
/* ------------------------------------------------------------------ */

describe('vue-emitter — typed action protocol', () => {
  it('adapts a supported component event to a required consumer action', () => {
    const schema: UiSchema = {
      version: '1.0',
      screens: [{
        id: 'form',
        component: 'Stack',
        layout: { type: 'stack' },
        children: [{
          id: 'btn',
          component: 'Button',
          bindings: { onActivate: 'handleActivate' },
        }],
      }],
    };
    const result = emit(schema, { typescript: true, styling: 'inline' });
    expect(result.code).toContain('handleActivate: () => void;');
    expect(result.code).toContain('@activate="handleActivate"');
    expect(result.code).toContain('actions.handleActivate();');
    expect(result.code).not.toMatch(/TODO|=>\s*\{\s*\}/);
  });
});
