import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  OTP_CODE_LENGTH,
} from '../lib/authEmail';

export default function OtpInput({
  length = OTP_CODE_LENGTH,
  onComplete,
  disabled = false,
  hasError = false,
  resetKey = 0,
  label = 'Verification code',
}) {
  const [digits, setDigits] =
    useState(
      () =>
        Array(length).fill(''),
    );

  const inputsRef = useRef([]);

  useEffect(() => {
    setDigits(
      Array(length).fill(''),
    );

    const first =
      inputsRef.current[0];

    if (
      first &&
      !disabled
    ) {
      first.focus();
    }
  }, [resetKey, length, disabled]);

  const emit = (next) => {
    setDigits(next);

    const code = next.join('');

    if (
      code.length === length &&
      !next.includes('') &&
      typeof onComplete ===
        'function'
    ) {
      onComplete(code);
    }
  };

  const focusBox = (index) => {
    const target =
      inputsRef.current[index];

    if (target) {
      target.focus();
      target.select();
    }
  };

  const handleChange = (
    index,
    raw,
  ) => {
    const clean = String(
      raw || '',
    ).replace(/\D/g, '');

    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);

      return;
    }

    const chars = clean.split('');
    const next = [...digits];

    let cursor = index;

    chars.forEach((char) => {
      if (cursor < length) {
        next[cursor] = char;
        cursor += 1;
      }
    });

    emit(next);
    focusBox(
      Math.min(
        cursor,
        length - 1,
      ),
    );
  };

  const handleKeyDown = (
    index,
    event,
  ) => {
    if (
      event.key ===
        'Backspace' &&
      !digits[index] &&
      index > 0
    ) {
      event.preventDefault();

      const next = [...digits];
      next[index - 1] = '';

      setDigits(next);
      focusBox(index - 1);
    }

    if (
      event.key ===
        'ArrowLeft' &&
      index > 0
    ) {
      event.preventDefault();
      focusBox(index - 1);
    }

    if (
      event.key ===
        'ArrowRight' &&
      index < length - 1
    ) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (
    event,
  ) => {
    event.preventDefault();

    const text = (
      event.clipboardData?.getData(
        'text',
      ) || ''
    ).replace(/\D/g, '');

    if (!text) {
      return;
    }

    const next = Array(
      length,
    ).fill('');

    text
      .slice(0, length)
      .split('')
      .forEach((char, i) => {
        next[i] = char;
      });

    emit(next);
    focusBox(
      Math.min(
        text.length,
        length - 1,
      ),
    );
  };

  return (
    <div className="otp-field">
      <span className="otp-label">
        {label}
      </span>

      <div
        className={
          hasError
            ? 'otp-grid otp-grid-error'
            : 'otp-grid'
        }
        onPaste={handlePaste}
      >
        {digits.map(
          (digit, index) => (
            <input
              key={`${resetKey}-${index}`}
              ref={(node) => {
                inputsRef.current[
                  index
                ] = node;
              }}
              className={
                digit
                  ? 'otp-box otp-box-filled'
                  : 'otp-box'
              }
              type="text"
              inputMode="numeric"
              autoComplete={
                index === 0
                  ? 'one-time-code'
                  : 'off'
              }
              maxLength={1}
              value={digit}
              disabled={disabled}
              onChange={(event) =>
                handleChange(
                  index,
                  event.target.value,
                )
              }
              onKeyDown={(
                event,
              ) =>
                handleKeyDown(
                  index,
                  event,
                )
              }
              onFocus={(
                event,
              ) =>
                event.target.select()
              }
              aria-label={`Digit ${index + 1}`}
            />
          ),
        )}
      </div>
    </div>
  );
}
