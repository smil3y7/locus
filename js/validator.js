// /js/validator.js
// Validation layer only. No DOM access. No DB access.

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  // Date fields store { value, precision } — an empty date looks like
  // { value: '', precision: 'day' }, which isn't null/string/array but is
  // still "empty" for validation purposes. Blob/File objects also aren't
  // null/string/array but must NOT be treated as this date-shape case.
  if (
    value &&
    typeof value === 'object' &&
    !(value instanceof Blob) &&
    'value' in value &&
    (value.value === '' || value.value === null || value.value === undefined)
  ) {
    return true;
  }
  return false;
}

function isValidPartialDate(dateValue) {
  if (!dateValue || typeof dateValue !== 'object' || !dateValue.value) return false;
  const { value, precision } = dateValue;
  if (precision === 'text') return String(value).trim().length > 0; // free-text approximate dating
  if (precision === 'year') return /^\d{4}$/.test(value);
  if (precision === 'month') return /^\d{4}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}-01`).getTime());
  return !Number.isNaN(new Date(value).getTime());
}

function validateField(field, rawValue) {
  const errors = [];

  if (field.required && isEmpty(rawValue)) {
    errors.push(`Polje "${field.label}" je obvezno.`);
    return errors;
  }

  if (isEmpty(rawValue)) return errors; // optional & empty is fine

  switch (field.type) {
    case 'number': {
      const num = Number(rawValue);
      if (Number.isNaN(num)) {
        errors.push(`Polje "${field.label}" mora biti številka.`);
      }
      break;
    }
    case 'date': {
      if (!isValidPartialDate(rawValue)) {
        errors.push(`Polje "${field.label}" mora imeti veljaven datum.`);
      }
      break;
    }
    case 'select': {
      if (Array.isArray(field.options) && field.options.length > 0) {
        if (!field.options.includes(rawValue)) {
          errors.push(`Polje "${field.label}" ima neveljavno vrednost.`);
        }
      }
      break;
    }
    case 'measurements': {
      if (!Array.isArray(rawValue)) {
        errors.push(`Polje "${field.label}" ima neveljavno obliko podatkov.`);
        break;
      }
      const typesById = new Map((field.measurementTypes || []).map((t) => [t.id, t]));
      for (const row of rawValue) {
        const typeDef = typesById.get(row.type);
        if (!typeDef) {
          errors.push(`Polje "${field.label}" vsebuje neveljavno vrsto mere.`);
          continue;
        }
        if (row.value === undefined || row.value === '' || Number.isNaN(Number(row.value))) {
          errors.push(`Polje "${field.label}" (${typeDef.label}) mora imeti veljavno številsko vrednost.`);
        }
        if (typeDef.units.length > 0 && !typeDef.units.includes(row.unit)) {
          errors.push(`Polje "${field.label}" (${typeDef.label}) ima neveljavno enoto.`);
        }
      }
      break;
    }
    case 'group': {
      if (!Array.isArray(rawValue)) {
        errors.push(`Polje "${field.label}" ima neveljavno obliko podatkov.`);
        break;
      }
      const subFields = field.subFields || [];
      rawValue.forEach((item, idx) => {
        for (const sf of subFields) {
          const subErrors = validateField(sf, item ? item[sf.id] : undefined);
          errors.push(...subErrors.map((e) => `Polje "${field.label}" #${idx + 1}: ${e}`));
        }
      });
      break;
    }
    default:
      break; // text, image, document: presence already checked above
  }

  return errors;
}

function validateEntry(data, config) {
  const errors = [];

  if (!config || !Array.isArray(config.fields)) {
    return { valid: false, errors: ['Konfiguracija obrazca ni na voljo.'] };
  }

  const values = (data && data.values) || {};

  for (const field of config.fields) {
    const fieldErrors = validateField(field, values[field.id]);
    errors.push(...fieldErrors);
  }

  return { valid: errors.length === 0, errors };
}

const Validator = { validateEntry, validateField };

export default Validator;
