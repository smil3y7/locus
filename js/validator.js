// /js/validator.js
// Validation layer only. No DOM access. No DB access.

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateField(field, rawValue) {
  const errors = [];

  if (field.required && isEmpty(rawValue) && field.type !== 'image') {
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
      const date = new Date(rawValue);
      if (Number.isNaN(date.getTime())) {
        errors.push(`Polje "${field.label}" mora biti veljaven datum.`);
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
    default:
      break; // text, image: presence already checked above
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
    const rawValue = field.type === 'image' ? data.photo : values[field.id];
    const fieldErrors = validateField(field, rawValue);
    errors.push(...fieldErrors);
  }

  return { valid: errors.length === 0, errors };
}

const Validator = { validateEntry, validateField };

export default Validator;
