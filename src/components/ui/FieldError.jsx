import Icon from './Icon';

/**
 * Branded inline field error. Replaces the browser-native
 * "Please fill out this field" bubble everywhere it is used:
 * pair with noValidate on the form, aria-invalid +
 * aria-describedby on the input, and focus the first invalid
 * field on submit.
 */
export default function FieldError({
  id,
  message,
}) {
  if (!message) {
    return null;
  }

  return (
    <span
      className="field-error"
      role="alert"
      id={id}
    >
      <Icon
        name="error"
        size={15}
      />

      {message}
    </span>
  );
}
