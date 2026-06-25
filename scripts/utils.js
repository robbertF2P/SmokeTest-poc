'use strict';

function schemaForSample(sample) {
  if (sample === null) {
    return { nullable: true };
  }

  if (Array.isArray(sample)) {
    return {
      type: 'array',
      items: sample.length > 0 ? schemaForSample(sample[0]) : {},
    };
  }

  switch (typeof sample) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return Number.isInteger(sample) ? { type: 'integer' } : { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object': {
      const properties = {};
      const required = [];
      for (const [key, value] of Object.entries(sample)) {
        properties[key] = schemaForSample(value);
        required.push(key);
      }
      return { type: 'object', properties, required };
    }
    default:
      return {};
  }
}

function parseBody(body) {
  if (typeof body !== 'string') {
    return body;
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

module.exports = { schemaForSample, parseBody };
