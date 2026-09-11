import { formatKobo } from '../../lib/money';

export function MoneyDisplay({ kobo, className = '' }) {
  return (
    <span className={`posho-long-value ${className}`.trim()}>
      {formatKobo(kobo)}
    </span>
  );
}

export default MoneyDisplay;
